#!/usr/bin/env node
/**
 * Performance monitoring system for VibeSheets
 * Tracks response times, error rates, and resource usage
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
    constructor(config = {}) {
        this.config = {
            logFile: config.logFile || path.join(__dirname, '../logs/performance.log'),
            metricsFile: config.metricsFile || path.join(__dirname, '../logs/metrics.json'),
            alertThresholds: {
                responseTime: config.responseTimeThreshold || 5000, // 5 seconds
                errorRate: config.errorRateThreshold || 0.05, // 5%
                memoryUsage: config.memoryThreshold || 0.85, // 85%
                cpuUsage: config.cpuThreshold || 0.80, // 80%
                ...config.alertThresholds
            },
            sampleInterval: config.sampleInterval || 60000, // 1 minute
            retentionDays: config.retentionDays || 30,
            ...config
        };
        
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                avgResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0
            },
            system: {
                memoryUsage: 0,
                cpuUsage: 0,
                diskUsage: 0,
                activeConnections: 0
            },
            errors: {
                total: 0,
                rate: 0,
                byType: {}
            },
            custom: {}
        };
        
        this.responseTimes = [];
        this.errorCounts = {};
        this.startTime = Date.now();
        
        this.ensureDirectories();
        this.startMonitoring();
    }

    ensureDirectories() {
        const dirs = [
            path.dirname(this.config.logFile),
            path.dirname(this.config.metricsFile)
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    startMonitoring() {
        console.log('Starting performance monitoring...');
        
        // Collect system metrics periodically
        setInterval(() => {
            this.collectSystemMetrics();
            this.calculateDerivedMetrics();
            this.saveMetrics();
            this.cleanupOldData();
        }, this.config.sampleInterval);
        
        // Initial collection
        this.collectSystemMetrics();
    }

    // Track HTTP request performance
    trackRequest(endpoint, method, responseTime, statusCode, error = null) {
        this.metrics.requests.total++;
        
        if (error || statusCode >= 400) {
            this.metrics.requests.failed++;
            this.trackError(error || `HTTP ${statusCode}`, endpoint);
        } else {
            this.metrics.requests.successful++;
        }
        
        // Track response times
        this.responseTimes.push(responseTime);
        
        // Keep only last 1000 response times for percentile calculations
        if (this.responseTimes.length > 1000) {
            this.responseTimes.shift();
        }
        
        // Update average response time (exponential moving average)
        if (this.metrics.requests.avgResponseTime === 0) {
            this.metrics.requests.avgResponseTime = responseTime;
        } else {
            this.metrics.requests.avgResponseTime = 
                (this.metrics.requests.avgResponseTime * 0.9) + (responseTime * 0.1);
        }
        
        // Log slow requests
        if (responseTime > this.config.alertThresholds.responseTime) {
            this.logPerformanceIssue('SLOW_REQUEST', {
                endpoint,
                method,
                responseTime,
                threshold: this.config.alertThresholds.responseTime
            });
        }
        
        this.logRequest(endpoint, method, responseTime, statusCode, error);
    }

    trackError(error, context = '') {
        this.metrics.errors.total++;
        
        const errorType = typeof error === 'string' ? error : error.name || 'Unknown';
        
        if (!this.metrics.errors.byType[errorType]) {
            this.metrics.errors.byType[errorType] = 0;
        }
        this.metrics.errors.byType[errorType]++;
        
        this.logError(errorType, error, context);
    }

    trackCustomMetric(name, value, tags = {}) {
        if (!this.metrics.custom[name]) {
            this.metrics.custom[name] = {
                current: value,
                total: value,
                count: 1,
                avg: value,
                min: value,
                max: value,
                tags
            };
        } else {
            const metric = this.metrics.custom[name];
            metric.current = value;
            metric.total += value;
            metric.count++;
            metric.avg = metric.total / metric.count;
            metric.min = Math.min(metric.min, value);
            metric.max = Math.max(metric.max, value);
        }
    }

    collectSystemMetrics() {
        try {
            // Memory usage
            const memUsage = process.memoryUsage();
            this.metrics.system.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
            
            // CPU usage (simplified - would need more sophisticated tracking in production)
            const cpuUsage = process.cpuUsage();
            this.metrics.system.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
            
            // Track memory leaks
            if (this.metrics.system.memoryUsage > this.config.alertThresholds.memoryUsage) {
                this.logPerformanceIssue('HIGH_MEMORY_USAGE', {
                    memoryUsage: this.metrics.system.memoryUsage,
                    threshold: this.config.alertThresholds.memoryUsage,
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal
                });
            }
            
        } catch (error) {
            console.error('Failed to collect system metrics:', error);
        }
    }

    calculateDerivedMetrics() {
        // Calculate percentiles for response times
        if (this.responseTimes.length > 0) {
            const sorted = [...this.responseTimes].sort((a, b) => a - b);
            const p95Index = Math.floor(sorted.length * 0.95);
            const p99Index = Math.floor(sorted.length * 0.99);
            
            this.metrics.requests.p95ResponseTime = sorted[p95Index] || 0;
            this.metrics.requests.p99ResponseTime = sorted[p99Index] || 0;
        }
        
        // Calculate error rate
        if (this.metrics.requests.total > 0) {
            this.metrics.errors.rate = this.metrics.requests.failed / this.metrics.requests.total;
            
            // Alert on high error rate
            if (this.metrics.errors.rate > this.config.alertThresholds.errorRate) {
                this.logPerformanceIssue('HIGH_ERROR_RATE', {
                    errorRate: this.metrics.errors.rate,
                    threshold: this.config.alertThresholds.errorRate,
                    totalRequests: this.metrics.requests.total,
                    failedRequests: this.metrics.requests.failed
                });
            }
        }
    }

    saveMetrics() {
        const timestamp = new Date().toISOString();
        const snapshot = {
            timestamp,
            uptime: Date.now() - this.startTime,
            metrics: { ...this.metrics }
        };
        
        try {
            // Save current metrics
            fs.writeFileSync(this.config.metricsFile, JSON.stringify(snapshot, null, 2));
            
            // Append to historical log
            const logEntry = `${timestamp},${JSON.stringify(this.metrics)}\n`;
            fs.appendFileSync(this.config.logFile, logEntry);
            
        } catch (error) {
            console.error('Failed to save metrics:', error);
        }
    }

    logRequest(endpoint, method, responseTime, statusCode, error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'REQUEST',
            endpoint,
            method,
            responseTime,
            statusCode,
            error: error ? (typeof error === 'string' ? error : error.message) : null
        };
        
        this.writeLog(logEntry);
    }

    logError(errorType, error, context) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'ERROR',
            errorType,
            message: typeof error === 'string' ? error : error.message,
            stack: error.stack,
            context
        };
        
        this.writeLog(logEntry);
    }

    logPerformanceIssue(issueType, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'PERFORMANCE_ISSUE',
            issueType,
            details
        };
        
        console.warn(`Performance Issue [${issueType}]:`, details);
        this.writeLog(logEntry);
    }

    writeLog(entry) {
        try {
            const logLine = JSON.stringify(entry) + '\n';
            fs.appendFileSync(this.config.logFile, logLine);
        } catch (error) {
            console.error('Failed to write log entry:', error);
        }
    }

    cleanupOldData() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
            
            // In a real implementation, you'd clean up old log files here
            // For now, just reset some in-memory data periodically
            if (this.responseTimes.length > 10000) {
                this.responseTimes = this.responseTimes.slice(-1000);
            }
            
        } catch (error) {
            console.error('Failed to cleanup old data:', error);
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.startTime,
            timestamp: new Date().toISOString()
        };
    }

    getHealthScore() {
        let score = 100;
        
        // Deduct points for high error rate
        if (this.metrics.errors.rate > 0.01) { // > 1%
            score -= Math.min(50, this.metrics.errors.rate * 1000);
        }
        
        // Deduct points for slow response times
        if (this.metrics.requests.avgResponseTime > 1000) { // > 1 second
            score -= Math.min(30, (this.metrics.requests.avgResponseTime - 1000) / 100);
        }
        
        // Deduct points for high memory usage
        if (this.metrics.system.memoryUsage > 0.7) { // > 70%
            score -= Math.min(20, (this.metrics.system.memoryUsage - 0.7) * 100);
        }
        
        return Math.max(0, Math.round(score));
    }

    generateReport() {
        const metrics = this.getMetrics();
        const healthScore = this.getHealthScore();
        
        return {
            summary: {
                healthScore,
                uptime: metrics.uptime,
                totalRequests: metrics.requests.total,
                errorRate: (metrics.errors.rate * 100).toFixed(2) + '%',
                avgResponseTime: metrics.requests.avgResponseTime.toFixed(0) + 'ms',
                memoryUsage: (metrics.system.memoryUsage * 100).toFixed(1) + '%'
            },
            requests: metrics.requests,
            errors: metrics.errors,
            system: metrics.system,
            custom: metrics.custom,
            timestamp: metrics.timestamp
        };
    }

    // Express middleware for automatic request tracking
    middleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            
            // Override res.end to capture response time
            const originalEnd = res.end;
            res.end = (...args) => {
                const responseTime = performance.now() - startTime;
                this.trackRequest(req.path, req.method, responseTime, res.statusCode);
                originalEnd.apply(res, args);
            };
            
            next();
        };
    }

    stop() {
        console.log('Stopping performance monitor...');
        // Save final metrics
        this.saveMetrics();
    }
}

// CLI usage
if (require.main === module) {
    const monitor = new PerformanceMonitor();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        monitor.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        monitor.stop();
        process.exit(0);
    });
    
    // Example usage
    console.log('Performance monitor started. Generating sample data...');
    
    // Simulate some requests for demonstration
    setInterval(() => {
        const endpoints = ['/api/timesheets', '/api/auth', '/health'];
        const methods = ['GET', 'POST', 'PUT'];
        
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        const method = methods[Math.floor(Math.random() * methods.length)];
        const responseTime = Math.random() * 2000 + 100; // 100-2100ms
        const statusCode = Math.random() > 0.05 ? 200 : 500; // 5% error rate
        
        monitor.trackRequest(endpoint, method, responseTime, statusCode);
        
        // Track custom metrics
        monitor.trackCustomMetric('active_users', Math.floor(Math.random() * 100));
        monitor.trackCustomMetric('queue_length', Math.floor(Math.random() * 20));
        
    }, 1000);
    
    // Print report every 30 seconds
    setInterval(() => {
        const report = monitor.generateReport();
        console.log('\n=== Performance Report ===');
        console.log(`Health Score: ${report.summary.healthScore}/100`);
        console.log(`Requests: ${report.summary.totalRequests} (${report.summary.errorRate} error rate)`);
        console.log(`Avg Response Time: ${report.summary.avgResponseTime}`);
        console.log(`Memory Usage: ${report.summary.memoryUsage}`);
        console.log('==========================\n');
    }, 30000);
}

module.exports = PerformanceMonitor;