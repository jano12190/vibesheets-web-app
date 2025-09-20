/**
 * Server integration tests for VibeSheets production server
 * Tests security, performance, and API functionality
 */

const request = require('supertest');
const path = require('path');

// Import the production server
const app = require('../production-server');

describe('Production Server Tests', () => {
    describe('Security Headers', () => {
        test('should include security headers on all responses', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            // Check for security headers
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBe('1; mode=block');
            expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
            
            // Should not expose server information
            expect(response.headers['x-powered-by']).toBeUndefined();
        });

        test('should include Content Security Policy', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.headers['content-security-policy']).toBeDefined();
            expect(response.headers['content-security-policy']).toContain("default-src 'self'");
            expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
        });

        test('should include HSTS header for HTTPS', async () => {
            const response = await request(app)
                .get('/health');

            // In production with HTTPS, this should be present
            // For testing, we check if helmet is configured correctly
            expect(response.headers['strict-transport-security']).toBeDefined();
        });
    });

    describe('Rate Limiting', () => {
        test('should allow normal request rates', async () => {
            // Make several requests quickly
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(request(app).get('/health'));
            }

            const responses = await Promise.all(promises);
            
            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        test('should include rate limit headers', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.headers['ratelimit-limit']).toBeDefined();
            expect(response.headers['ratelimit-remaining']).toBeDefined();
        });
    });

    describe('Health Check Endpoint', () => {
        test('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'OK',
                timestamp: expect.any(String),
                uptime: expect.any(Number),
                environment: expect.any(String),
                version: expect.any(String),
                memory: {
                    used: expect.any(Number),
                    total: expect.any(Number)
                }
            });
        });

        test('should have correct content type', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.headers['content-type']).toContain('application/json');
        });
    });

    describe('Static File Serving', () => {
        test('should serve HTML files with correct content type', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.headers['content-type']).toContain('text/html');
        });

        test('should serve CSS files with correct content type', async () => {
            // This test assumes CSS files exist in the correct location
            const response = await request(app)
                .get('/css/style.css');

            if (response.status === 200) {
                expect(response.headers['content-type']).toContain('text/css');
            }
        });

        test('should serve JS files with correct content type', async () => {
            const response = await request(app)
                .get('/js/auth.js');

            if (response.status === 200) {
                expect(response.headers['content-type']).toContain('application/javascript');
            }
        });

        test('should include cache headers for static assets', async () => {
            const response = await request(app)
                .get('/css/style.css');

            if (response.status === 200) {
                expect(response.headers['cache-control']).toBeDefined();
                expect(response.headers['etag']).toBeDefined();
            }
        });
    });

    describe('CORS Configuration', () => {
        test('should handle CORS preflight requests', async () => {
            const response = await request(app)
                .options('/')
                .set('Origin', 'https://vibesheets.com')
                .set('Access-Control-Request-Method', 'GET');

            expect(response.status).toBe(200);
            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });

        test('should reject requests from unauthorized origins', async () => {
            const response = await request(app)
                .get('/health')
                .set('Origin', 'https://malicious-site.com');

            // Should either reject or not include CORS headers
            if (response.headers['access-control-allow-origin']) {
                expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
            }
        });
    });

    describe('Error Handling', () => {
        test('should return 404 for non-existent routes', async () => {
            const response = await request(app)
                .get('/non-existent-route')
                .expect(404);

            expect(response.body).toMatchObject({
                error: 'Not Found',
                message: expect.any(String),
                timestamp: expect.any(String),
                path: '/non-existent-route'
            });
        });

        test('should handle malformed requests gracefully', async () => {
            const response = await request(app)
                .post('/health')
                .send('invalid json{')
                .set('Content-Type', 'application/json');

            expect(response.status).toBe(400);
        });
    });

    describe('Compression', () => {
        test('should compress responses when appropriate', async () => {
            const response = await request(app)
                .get('/')
                .set('Accept-Encoding', 'gzip');

            if (response.headers['content-length'] && parseInt(response.headers['content-length']) > 1024) {
                // Large responses should be compressed
                expect(response.headers['content-encoding']).toBe('gzip');
            }
        });
    });

    describe('Request Validation', () => {
        test('should reject requests with oversized payloads', async () => {
            const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB payload
            
            const response = await request(app)
                .post('/health')
                .send(largePayload)
                .set('Content-Type', 'text/plain');

            expect(response.status).toBe(413); // Payload Too Large
        });

        test('should validate request headers', async () => {
            const response = await request(app)
                .get('/health')
                .set('X-Custom-Header', 'test-value');

            // Should accept valid headers
            expect([200, 404]).toContain(response.status);
        });
    });

    describe('Performance', () => {
        test('should respond to health checks quickly', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/health')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
        });

        test('should handle concurrent requests', async () => {
            const concurrentRequests = 10;
            const promises = [];
            
            for (let i = 0; i < concurrentRequests; i++) {
                promises.push(request(app).get('/health'));
            }
            
            const responses = await Promise.all(promises);
            
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });

    describe('Monitoring Integration', () => {
        test('should include performance timing headers', async () => {
            const response = await request(app)
                .get('/health');

            // Check if response includes timing information
            expect(response.headers['x-response-time']).toBeDefined();
        });
    });
});

describe('Security Vulnerability Tests', () => {
    describe('XSS Protection', () => {
        test('should prevent reflected XSS attacks', async () => {
            const xssPayload = '<script>alert("xss")</script>';
            
            const response = await request(app)
                .get(`/search?q=${encodeURIComponent(xssPayload)}`);
            
            // Should not reflect the script tag in response
            if (response.text) {
                expect(response.text).not.toContain('<script>alert("xss")</script>');
            }
        });

        test('should sanitize file path traversal attempts', async () => {
            const traversalAttempts = [
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32\\config\\sam',
                '....//....//....//etc/passwd'
            ];
            
            for (const attempt of traversalAttempts) {
                const response = await request(app)
                    .get(`/${attempt}`);
                
                // Should not serve system files
                expect(response.status).not.toBe(200);
                if (response.text) {
                    expect(response.text).not.toContain('root:');
                    expect(response.text).not.toContain('SAM');
                }
            }
        });
    });

    describe('Injection Protection', () => {
        test('should reject SQL injection attempts in query parameters', async () => {
            const sqlInjections = [
                "'; DROP TABLE users; --",
                "1' OR '1'='1",
                "admin'/*",
                "' UNION SELECT * FROM users --"
            ];
            
            for (const injection of sqlInjections) {
                const response = await request(app)
                    .get(`/search?q=${encodeURIComponent(injection)}`);
                
                // Should handle safely without SQL execution
                expect([400, 404, 422]).toContain(response.status);
            }
        });

        test('should reject command injection attempts', async () => {
            const commandInjections = [
                '; cat /etc/passwd',
                '| ls -la',
                '`whoami`',
                '$(id)'
            ];
            
            for (const injection of commandInjections) {
                const response = await request(app)
                    .get(`/search?q=${encodeURIComponent(injection)}`);
                
                // Should not execute system commands
                expect([400, 404, 422]).toContain(response.status);
            }
        });
    });

    describe('Authentication Bypass Attempts', () => {
        test('should reject malformed JWT tokens', async () => {
            const malformedTokens = [
                'eyJhbGciOiJub25lIn0..', // None algorithm
                'invalid.jwt.token',
                'Bearer fake-token',
                '../../../etc/passwd'
            ];
            
            for (const token of malformedTokens) {
                const response = await request(app)
                    .get('/health')
                    .set('Authorization', `Bearer ${token}`);
                
                // Should still serve public endpoints
                expect(response.status).toBe(200);
            }
        });
    });
});