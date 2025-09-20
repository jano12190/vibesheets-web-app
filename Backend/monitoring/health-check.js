#!/usr/bin/env node
/**
 * Comprehensive health check and monitoring system for VibeSheets
 * Monitors application health, performance, and alerts on issues
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class HealthMonitor {
    constructor(config = {}) {
        this.config = {
            baseUrl: config.baseUrl || 'https://vibesheets.com',
            apiUrl: config.apiUrl || 'https://api.vibesheets.com',
            checkInterval: config.checkInterval || 60000, // 1 minute
            alertThreshold: config.alertThreshold || 3, // Alert after 3 consecutive failures
            timeout: config.timeout || 10000, // 10 second timeout
            logFile: config.logFile || path.join(__dirname, '../logs/health.log'),
            webhookUrl: config.webhookUrl || null, // Slack/Teams webhook for alerts
            ...config
        };
        
        this.consecutiveFailures = 0;
        this.isAlerting = false;
        this.metrics = {
            uptime: 0,
            totalChecks: 0,
            failedChecks: 0,
            avgResponseTime: 0,
            lastCheck: null,
            lastFailure: null
        };
        
        this.ensureLogDirectory();
        this.startMonitoring();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.config.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    async startMonitoring() {
        console.log(`Starting health monitoring for ${this.config.baseUrl}`);
        console.log(`Check interval: ${this.config.checkInterval}ms`);
        console.log(`Alert threshold: ${this.config.alertThreshold} consecutive failures`);
        
        // Initial check
        await this.performHealthCheck();
        
        // Schedule regular checks
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.checkInterval);
    }

    async performHealthCheck() {
        const startTime = Date.now();
        this.metrics.totalChecks++;
        this.metrics.lastCheck = new Date().toISOString();
        
        try {
            console.log(`[${new Date().toISOString()}] Performing health check...`);
            
            // Check multiple endpoints
            const checks = await Promise.allSettled([
                this.checkEndpoint(`${this.config.baseUrl}/health`, 'Frontend Health'),
                this.checkEndpoint(`${this.config.apiUrl}/auth`, 'API Auth Endpoint'),
                this.checkEndpoint(this.config.baseUrl, 'Main Website'),
                this.checkSSLCertificate(this.config.baseUrl),
                this.checkDNSResolution('vibesheets.com')
            ]);

            const failures = checks.filter(result => result.status === 'rejected');
            const responseTime = Date.now() - startTime;
            
            // Update metrics
            this.updateMetrics(responseTime, failures.length === 0);
            
            if (failures.length === 0) {
                this.consecutiveFailures = 0;
                if (this.isAlerting) {
                    await this.sendRecoveryAlert();
                    this.isAlerting = false;
                }
                this.log('SUCCESS', `All health checks passed (${responseTime}ms)`);
            } else {
                this.consecutiveFailures++;
                this.metrics.lastFailure = new Date().toISOString();
                
                const failureDetails = failures.map(f => f.reason).join(', ');
                this.log('FAILURE', `${failures.length}/${checks.length} checks failed: ${failureDetails}`);
                
                if (this.consecutiveFailures >= this.config.alertThreshold && !this.isAlerting) {
                    await this.sendAlert('Health check failures detected', failureDetails);
                    this.isAlerting = true;
                }
            }
            
        } catch (error) {
            this.consecutiveFailures++;
            this.metrics.failedChecks++;
            this.metrics.lastFailure = new Date().toISOString();
            
            this.log('ERROR', `Health check failed: ${error.message}`);
            
            if (this.consecutiveFailures >= this.config.alertThreshold && !this.isAlerting) {
                await this.sendAlert('Critical health check error', error.message);
                this.isAlerting = true;
            }
        }
    }

    async checkEndpoint(url, name) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const protocol = url.startsWith('https:') ? https : http;
            
            const timeout = setTimeout(() => {
                reject(new Error(`${name}: Timeout after ${this.config.timeout}ms`));
            }, this.config.timeout);
            
            const req = protocol.get(url, (res) => {
                clearTimeout(timeout);
                const responseTime = Date.now() - startTime;
                
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    resolve({ name, status: res.statusCode, responseTime });
                } else {
                    reject(new Error(`${name}: HTTP ${res.statusCode}`));
                }
            });
            
            req.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`${name}: ${error.message}`));
            });
            
            req.setTimeout(this.config.timeout, () => {
                req.destroy();
                reject(new Error(`${name}: Request timeout`));
            });
        });
    }

    async checkSSLCertificate(url) {
        return new Promise((resolve, reject) => {
            if (!url.startsWith('https:')) {
                resolve({ name: 'SSL Check', status: 'skipped' });
                return;
            }
            
            const hostname = new URL(url).hostname;
            const options = {
                hostname,
                port: 443,
                method: 'GET',
                timeout: this.config.timeout
            };
            
            const req = https.request(options, (res) => {
                const cert = res.connection.getPeerCertificate();
                const now = new Date();
                const expiry = new Date(cert.valid_to);
                const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry < 30) {
                    reject(new Error(`SSL Certificate expires in ${daysUntilExpiry} days`));
                } else {
                    resolve({ name: 'SSL Certificate', daysUntilExpiry, status: 'valid' });
                }
            });
            
            req.on('error', (error) => {
                reject(new Error(`SSL Check: ${error.message}`));
            });
            
            req.setTimeout(this.config.timeout, () => {
                req.destroy();
                reject(new Error('SSL Check: Timeout'));
            });
            
            req.end();
        });
    }

    async checkDNSResolution(hostname) {
        const dns = require('dns').promises;
        
        try {
            const addresses = await dns.lookup(hostname);
            return { name: 'DNS Resolution', hostname, addresses, status: 'resolved' };
        } catch (error) {
            throw new Error(`DNS Resolution: ${error.message}`);
        }
    }

    updateMetrics(responseTime, success) {
        // Update average response time (moving average)
        if (this.metrics.avgResponseTime === 0) {
            this.metrics.avgResponseTime = responseTime;
        } else {
            this.metrics.avgResponseTime = (this.metrics.avgResponseTime * 0.9) + (responseTime * 0.1);
        }
        
        if (!success) {
            this.metrics.failedChecks++;
        }
        
        // Calculate uptime percentage
        this.metrics.uptime = ((this.metrics.totalChecks - this.metrics.failedChecks) / this.metrics.totalChecks) * 100;
    }

    async sendAlert(subject, details) {
        const alert = {
            timestamp: new Date().toISOString(),
            subject,
            details,
            consecutiveFailures: this.consecutiveFailures,
            metrics: this.metrics
        };
        
        console.error(`🚨 ALERT: ${subject} - ${details}`);
        this.log('ALERT', `${subject}: ${details}`);
        
        // Send to webhook if configured
        if (this.config.webhookUrl) {
            try {
                await this.sendWebhookAlert(alert);
            } catch (error) {
                this.log('ERROR', `Failed to send webhook alert: ${error.message}`);
            }
        }
        
        // Send email if configured
        if (this.config.emailConfig) {
            try {
                await this.sendEmailAlert(alert);
            } catch (error) {
                this.log('ERROR', `Failed to send email alert: ${error.message}`);
            }
        }
    }

    async sendRecoveryAlert() {
        const recovery = {
            timestamp: new Date().toISOString(),
            subject: 'Service Recovery',
            details: 'All health checks are now passing',
            metrics: this.metrics
        };
        
        console.log(`✅ RECOVERY: Service is healthy again`);
        this.log('RECOVERY', 'All health checks passing');
        
        if (this.config.webhookUrl) {
            try {
                await this.sendWebhookAlert(recovery, true);
            } catch (error) {
                this.log('ERROR', `Failed to send recovery webhook: ${error.message}`);
            }
        }
    }

    async sendWebhookAlert(alert, isRecovery = false) {
        const color = isRecovery ? '#00ff00' : '#ff0000';
        const emoji = isRecovery ? '✅' : '🚨';
        
        const payload = {
            text: `${emoji} VibeSheets ${alert.subject}`,
            attachments: [{
                color,
                fields: [
                    {
                        title: 'Details',
                        value: alert.details,
                        short: false
                    },
                    {
                        title: 'Uptime',
                        value: `${alert.metrics.uptime.toFixed(2)}%`,
                        short: true
                    },
                    {
                        title: 'Avg Response Time',
                        value: `${alert.metrics.avgResponseTime.toFixed(0)}ms`,
                        short: true
                    },
                    {
                        title: 'Consecutive Failures',
                        value: alert.consecutiveFailures.toString(),
                        short: true
                    },
                    {
                        title: 'Last Check',
                        value: alert.metrics.lastCheck,
                        short: true
                    }
                ],
                footer: 'VibeSheets Health Monitor',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
        
        return this.makeHttpRequest(this.config.webhookUrl, 'POST', JSON.stringify(payload), {
            'Content-Type': 'application/json'
        });
    }

    makeHttpRequest(url, method, data, headers = {}) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;
            const urlObj = new URL(url);
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method,
                headers
            };
            
            const req = protocol.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                });
            });
            
            req.on('error', reject);
            req.setTimeout(this.config.timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            if (data) {
                req.write(data);
            }
            
            req.end();
        });
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}\n`;
        
        console.log(logEntry.trim());
        
        try {
            fs.appendFileSync(this.config.logFile, logEntry);
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            consecutiveFailures: this.consecutiveFailures,
            isAlerting: this.isAlerting
        };
    }

    // Graceful shutdown
    stop() {
        console.log('Stopping health monitor...');
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

// CLI usage
if (require.main === module) {
    const config = {
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        apiUrl: process.env.API_URL || 'https://api.vibesheets.com',
        checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000,
        webhookUrl: process.env.WEBHOOK_URL || null
    };
    
    const monitor = new HealthMonitor(config);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        monitor.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        monitor.stop();
        process.exit(0);
    });
}

module.exports = HealthMonitor;