/**
 * Jest setup file for VibeSheets tests
 * Configures global test environment and mocks
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock localStorage
const localStorageMock = {
  data: {},
  getItem: jest.fn(function(key) {
    return this.data[key] || null;
  }),
  setItem: jest.fn(function(key, value) {
    this.data[key] = value;
  }),
  removeItem: jest.fn(function(key) {
    delete this.data[key];
  }),
  clear: jest.fn(function() {
    this.data = {};
  })
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  data: {},
  getItem: jest.fn(function(key) {
    return this.data[key] || null;
  }),
  setItem: jest.fn(function(key, value) {
    this.data[key] = value;
  }),
  removeItem: jest.fn(function(key) {
    delete this.data[key];
  }),
  clear: jest.fn(function() {
    this.data = {};
  })
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Map()
  })
);

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => [])
};

// Mock crypto API for secure random generation
const cryptoMock = {
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  randomUUID: jest.fn(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  })
};

Object.defineProperty(global, 'crypto', {
  value: cryptoMock
});

// Mock URL constructor
global.URL = class URL {
  constructor(url, base) {
    if (base) {
      this.href = new URL(base).href + '/' + url;
    } else {
      this.href = url;
    }
    
    const urlObj = new require('url').URL(this.href);
    this.protocol = urlObj.protocol;
    this.hostname = urlObj.hostname;
    this.port = urlObj.port;
    this.pathname = urlObj.pathname;
    this.search = urlObj.search;
    this.hash = urlObj.hash;
    this.origin = urlObj.origin;
  }
  
  toString() {
    return this.href;
  }
};

// Mock alert, confirm, prompt
global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.prompt = jest.fn(() => 'test');

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock MutationObserver
global.MutationObserver = class MutationObserver {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock XMLHttpRequest
global.XMLHttpRequest = class XMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 200;
    this.statusText = 'OK';
    this.responseText = '';
    this.response = '';
    this.onreadystatechange = null;
  }
  
  open() {
    this.readyState = 1;
  }
  
  send() {
    this.readyState = 4;
    if (this.onreadystatechange) {
      this.onreadystatechange();
    }
  }
  
  setRequestHeader() {}
  getResponseHeader() { return null; }
  getAllResponseHeaders() { return ''; }
};

// Custom matchers
expect.extend({
  toBeValidJWT(received) {
    const parts = received.split('.');
    const pass = parts.length === 3 && 
                 parts.every(part => part.length > 0);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT format`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT format (3 parts separated by dots)`,
        pass: false
      };
    }
  },
  
  toBeValidTimeFormat(received) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const pass = timeRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid time format`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid time format (HH:MM)`,
        pass: false
      };
    }
  },
  
  toBeValidDateFormat(received) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const pass = dateRegex.test(received) && !isNaN(Date.parse(received));
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date format`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date format (YYYY-MM-DD)`,
        pass: false
      };
    }
  }
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset localStorage and sessionStorage
  localStorageMock.clear();
  sessionStorageMock.clear();
  
  // Reset fetch mock
  global.fetch.mockClear();
  
  // Clear any timers
  jest.clearAllTimers();
});

// Setup before all tests
beforeAll(() => {
  // Set NODE_ENV to test
  process.env.NODE_ENV = 'test';
  
  // Suppress deprecation warnings in tests
  process.removeAllListeners('warning');
});

// Cleanup after all tests
afterAll(() => {
  // Restore console if mocked
  jest.restoreAllMocks();
});