/**
 * Frontend integration tests for VibeSheets
 * Tests authentication, dashboard functionality, and user interactions
 */

const { JSDOM } = require('jsdom');
const fetch = require('node-fetch');

// Mock global fetch for tests
global.fetch = fetch;

describe('VibeSheets Frontend Tests', () => {
    let dom;
    let window;
    let document;
    let localStorage;

    beforeEach(() => {
        // Set up DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <head><title>VibeSheets Test</title></head>
                <body>
                    <div id="userDisplay">Loading...</div>
                    <div id="currentTime">--:--:--</div>
                    <div id="currentDate">Loading...</div>
                    <button id="clockInBtn">Clock In</button>
                    <button id="clockOutBtn" style="display: none;">Clock Out</button>
                    <div id="hoursDisplay">0.00h</div>
                    <div id="timeEntriesContainer"></div>
                    <select id="hoursPeriodSelect">
                        <option value="today">Today</option>
                        <option value="this-week">This Week</option>
                        <option value="this-month">This Month</option>
                    </select>
                </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.navigator = window.navigator;
        global.location = window.location;

        // Mock localStorage
        localStorage = {
            data: {},
            getItem: jest.fn(key => localStorage.data[key] || null),
            setItem: jest.fn((key, value) => { localStorage.data[key] = value; }),
            removeItem: jest.fn(key => { delete localStorage.data[key]; }),
            clear: jest.fn(() => { localStorage.data = {}; })
        };
        global.localStorage = localStorage;

        // Mock console methods
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn()
        };

        // Mock performance API
        global.performance = {
            now: jest.fn(() => Date.now())
        };
    });

    afterEach(() => {
        dom.window.close();
        jest.clearAllMocks();
    });

    describe('Authentication', () => {
        beforeEach(() => {
            // Load auth.js functions
            const authCode = require('fs').readFileSync(
                require('path').join(__dirname, '../Frontend/js/auth.js'), 
                'utf8'
            );
            
            // Execute auth code in our JSDOM environment
            const script = document.createElement('script');
            script.textContent = authCode;
            document.head.appendChild(script);
        });

        test('should check if user is authenticated with valid token', () => {
            // Set up valid token
            const futureTime = Date.now() + 3600000; // 1 hour from now
            localStorage.setItem('access_token', 'valid.jwt.token');
            localStorage.setItem('expires_at', JSON.stringify(futureTime));

            const result = window.isAuthenticated();
            expect(result).toBe(true);
        });

        test('should return false for expired token', () => {
            // Set up expired token
            const pastTime = Date.now() - 3600000; // 1 hour ago
            localStorage.setItem('access_token', 'expired.jwt.token');
            localStorage.setItem('expires_at', JSON.stringify(pastTime));

            const result = window.isAuthenticated();
            expect(result).toBe(false);
        });

        test('should return null for getAccessToken when not authenticated', () => {
            localStorage.clear();
            
            const result = window.getAccessToken();
            expect(result).toBe(null);
        });

        test('should return token when authenticated', () => {
            const futureTime = Date.now() + 3600000;
            const token = 'valid.jwt.token';
            localStorage.setItem('access_token', token);
            localStorage.setItem('expires_at', JSON.stringify(futureTime));

            const result = window.getAccessToken();
            expect(result).toBe(token);
        });

        test('should get current user when authenticated', () => {
            const futureTime = Date.now() + 3600000;
            const user = { email: 'test@example.com', name: 'Test User' };
            
            localStorage.setItem('access_token', 'valid.jwt.token');
            localStorage.setItem('expires_at', JSON.stringify(futureTime));
            localStorage.setItem('user', JSON.stringify(user));

            const result = window.getCurrentUser();
            expect(result).toEqual(user);
        });
    });

    describe('Dashboard Functionality', () => {
        beforeEach(() => {
            // Load dashboard.js functions
            const dashboardCode = require('fs').readFileSync(
                require('path').join(__dirname, '../Frontend/js/dashboard.js'), 
                'utf8'
            );
            
            // Set up authenticated state
            const futureTime = Date.now() + 3600000;
            localStorage.setItem('access_token', 'valid.jwt.token');
            localStorage.setItem('expires_at', JSON.stringify(futureTime));
            localStorage.setItem('user', JSON.stringify({ 
                email: 'test@example.com', 
                name: 'Test User' 
            }));

            // Mock fetch for API calls
            global.fetch = jest.fn();

            // Execute dashboard code
            const script = document.createElement('script');
            script.textContent = dashboardCode;
            document.head.appendChild(script);
        });

        test('should update clock display', () => {
            window.updateClock();
            
            const timeDisplay = document.getElementById('currentTime');
            const dateDisplay = document.getElementById('currentDate');
            
            expect(timeDisplay.textContent).not.toBe('--:--:--');
            expect(dateDisplay.textContent).not.toBe('Loading...');
        });

        test('should update clock button visibility based on status', () => {
            const clockInBtn = document.getElementById('clockInBtn');
            const clockOutBtn = document.getElementById('clockOutBtn');

            // Test clock out state (user is clocked in)
            window.clockStatus = 'in';
            window.updateClockButtons();
            
            expect(clockInBtn.style.display).toBe('none');
            expect(clockOutBtn.style.display).toBe('block');

            // Test clock in state (user is clocked out)
            window.clockStatus = 'out';
            window.updateClockButtons();
            
            expect(clockInBtn.style.display).toBe('block');
            expect(clockOutBtn.style.display).toBe('none');
        });

        test('should display user information', () => {
            window.displayUserInfo();
            
            const userDisplay = document.getElementById('userDisplay');
            expect(userDisplay.textContent).toBe('Hello, Test User');
        });

        test('should format dates correctly', () => {
            const testDate = new Date('2023-06-15T10:30:00.000Z');
            const result = window.formatDate(testDate);
            
            expect(result).toBe('2023-06-15');
        });

        test('should format time correctly', () => {
            const testTimestamp = '2023-06-15T14:30:00.000Z';
            const result = window.formatTimeOnly(testTimestamp);
            
            expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/);
        });

        test('should calculate duration correctly', () => {
            const clockIn = { timestamp: '2023-06-15T09:00:00.000Z' };
            const clockOut = { timestamp: '2023-06-15T17:00:00.000Z' };
            
            const result = window.calculateDuration(clockIn, clockOut);
            expect(result).toBe('8.00h');
        });

        test('should handle missing clock out', () => {
            const clockIn = { timestamp: '2023-06-15T09:00:00.000Z' };
            
            const result = window.calculateDuration(clockIn, null);
            expect(result).toBe('In Progress');
        });
    });

    describe('Input Validation', () => {
        beforeEach(() => {
            // Load security.js
            const securityCode = require('fs').readFileSync(
                require('path').join(__dirname, '../Frontend/js/security.js'), 
                'utf8'
            );
            
            const script = document.createElement('script');
            script.textContent = securityCode;
            document.head.appendChild(script);
        });

        test('should validate time format correctly', () => {
            const securityManager = new window.SecurityManager();
            
            expect(securityManager.validateTime('14:30')).toBe(true);
            expect(securityManager.validateTime('09:00')).toBe(true);
            expect(securityManager.validateTime('23:59')).toBe(true);
            
            expect(securityManager.validateTime('25:30')).toBe(false);
            expect(securityManager.validateTime('14:60')).toBe(false);
            expect(securityManager.validateTime('invalid')).toBe(false);
            expect(securityManager.validateTime('')).toBe(false);
        });

        test('should validate date format correctly', () => {
            const securityManager = new window.SecurityManager();
            
            expect(securityManager.validateDate('2023-06-15')).toBe(true);
            expect(securityManager.validateDate('2023-12-31')).toBe(true);
            
            expect(securityManager.validateDate('2023-13-01')).toBe(false);
            expect(securityManager.validateDate('2023-06-32')).toBe(false);
            expect(securityManager.validateDate('invalid-date')).toBe(false);
            expect(securityManager.validateDate('')).toBe(false);
        });

        test('should sanitize HTML input', () => {
            const securityManager = new window.SecurityManager();
            
            const maliciousInput = '<script>alert("xss")</script>Hello';
            const result = securityManager.sanitizeHTML(maliciousInput);
            
            expect(result).not.toContain('<script>');
            expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;Hello');
        });

        test('should validate email format', () => {
            const securityManager = new window.SecurityManager();
            
            expect(securityManager.validateEmail('test@example.com')).toBe(true);
            expect(securityManager.validateEmail('user.name@domain.co.uk')).toBe(true);
            
            expect(securityManager.validateEmail('invalid-email')).toBe(false);
            expect(securityManager.validateEmail('@domain.com')).toBe(false);
            expect(securityManager.validateEmail('user@')).toBe(false);
            expect(securityManager.validateEmail('')).toBe(false);
        });

        test('should detect suspicious activity patterns', () => {
            const securityManager = new window.SecurityManager();
            
            const suspiciousData = {
                input: '<script>evil()</script>',
                value: 'javascript:alert(1)'
            };
            
            const result = securityManager.detectSuspiciousActivity('test_action', suspiciousData);
            expect(result).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors gracefully', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            
            // Load dashboard.js to get apiCall function
            const dashboardCode = require('fs').readFileSync(
                require('path').join(__dirname, '../Frontend/js/dashboard.js'), 
                'utf8'
            );
            
            const script = document.createElement('script');
            script.textContent = dashboardCode;
            document.head.appendChild(script);

            // Set up authenticated state
            const futureTime = Date.now() + 3600000;
            localStorage.setItem('access_token', 'valid.jwt.token');
            localStorage.setItem('expires_at', JSON.stringify(futureTime));

            try {
                await window.apiCall('/test', 'GET');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Network error');
            }
        });

        test('should handle authentication errors', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                status: 401,
                statusText: 'Unauthorized'
            });

            // Mock window.location.href
            delete window.location;
            window.location = { href: '' };

            // Load dashboard.js
            const dashboardCode = require('fs').readFileSync(
                require('path').join(__dirname, '../Frontend/js/dashboard.js'), 
                'utf8'
            );
            
            const script = document.createElement('script');
            script.textContent = dashboardCode;
            document.head.appendChild(script);

            // Set up authenticated state
            const futureTime = Date.now() + 3600000;
            localStorage.setItem('access_token', 'valid.jwt.token');
            localStorage.setItem('expires_at', JSON.stringify(futureTime));

            try {
                await window.apiCall('/test', 'GET');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toBe('Authentication failed');
                expect(localStorage.getItem('access_token')).toBe(null);
            }
        });
    });
});

describe('Security Tests', () => {
    test('should prevent XSS attacks', () => {
        const dom = new JSDOM(`
            <div id="output"></div>
        `);
        
        const document = dom.window.document;
        const output = document.getElementById('output');
        
        // Simulate user input that could contain XSS
        const userInput = '<img src=x onerror=alert("xss")>';
        
        // Should sanitize the input
        output.textContent = userInput; // textContent is safe
        
        expect(output.innerHTML).not.toContain('<img');
        expect(output.innerHTML).not.toContain('onerror');
    });

    test('should validate JWT token format', () => {
        const dom = new JSDOM();
        global.window = dom.window;
        global.document = dom.window.document;

        // Load security.js
        const securityCode = require('fs').readFileSync(
            require('path').join(__dirname, '../Frontend/js/security.js'), 
            'utf8'
        );
        
        const script = dom.window.document.createElement('script');
        script.textContent = securityCode;
        dom.window.document.head.appendChild(script);

        const securityManager = new dom.window.SecurityManager();
        
        // Valid JWT format (3 parts separated by dots)
        expect(securityManager.validateJWTFormat('eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ')).toBe(true);
        
        // Invalid formats
        expect(securityManager.validateJWTFormat('invalid.token')).toBe(false);
        expect(securityManager.validateJWTFormat('too.many.parts.here')).toBe(false);
        expect(securityManager.validateJWTFormat('')).toBe(false);
        expect(securityManager.validateJWTFormat(null)).toBe(false);
    });
});