#!/usr/bin/env node
/**
 * Production-ready Express server for VibeSheets
 * Includes security headers, compression, rate limiting, and monitoring
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, 'Frontend');

// Trust proxy for rate limiting behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", // Required for inline scripts
                "https://cdnjs.cloudflare.com",
                "https://cdn.auth0.com"
            ],
            styleSrc: [
                "'self'", 
                "'unsafe-inline'", // Required for inline styles
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            connectSrc: [
                "'self'",
                "https://api.vibesheets.com",
                "https://*.auth0.com"
            ],
            imgSrc: [
                "'self'",
                "data:"
            ],
            frameAncestors: ["'none'"],
            formAction: ["'self'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Compression middleware
app.use(compression({
    threshold: 1024, // Only compress responses > 1KB
    level: 6, // Compression level (1-9, 6 is balanced)
    filter: (req, res) => {
        // Don't compress images
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://vibesheets.com',
            'https://www.vibesheets.com',
            'https://api.vibesheets.com'
        ];
        
        // In development, allow localhost
        if (process.env.NODE_ENV !== 'production') {
            allowedOrigins.push('http://localhost:3000', 'http://localhost:8000');
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for static assets
        return req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/);
    }
});

app.use(limiter);

// Logging middleware
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat, {
    skip: (req, res) => {
        // Skip logging for health checks and static assets
        return req.url === '/health' || req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/);
    }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
        }
    };
    
    res.status(200).json(health);
});

// Security headers middleware for all responses
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    next();
});

// Custom MIME type middleware
app.use((req, res, next) => {
    const ext = path.extname(req.url);
    
    switch (ext) {
        case '.js':
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            break;
        case '.css':
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            break;
        case '.html':
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            break;
        case '.json':
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            break;
        case '.png':
            res.setHeader('Content-Type', 'image/png');
            break;
        case '.svg':
            res.setHeader('Content-Type', 'image/svg+xml');
            break;
    }
    
    next();
});

// Cache control for static assets
app.use('/css', express.static(path.join(STATIC_DIR, 'css'), {
    maxAge: '7d',
    etag: true,
    lastModified: true
}));

app.use('/js', express.static(path.join(STATIC_DIR, 'js'), {
    maxAge: '1d', // Shorter cache for JS files that may change
    etag: true,
    lastModified: true
}));

app.use('/assets', express.static(path.join(STATIC_DIR, 'assets'), {
    maxAge: '30d', // Long cache for assets
    etag: true,
    lastModified: true
}));

// Serve static files with appropriate caching
app.use(express.static(STATIC_DIR, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    index: ['index.html']
}));

// SPA routing - serve index.html for client-side routes
app.get('*', (req, res, next) => {
    // Skip if it's an API call or has file extension
    if (req.url.startsWith('/api') || path.extname(req.url)) {
        return next();
    }
    
    // Serve appropriate HTML file
    let htmlFile = 'index.html';
    if (req.url.includes('dashboard')) {
        htmlFile = 'dashboard.html';
    }
    
    const filePath = path.join(STATIC_DIR, htmlFile);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Page not found' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    const errorResponse = {
        error: 'Internal Server Error',
        timestamp: new Date().toISOString(),
        path: req.url
    };
    
    if (isDevelopment) {
        errorResponse.details = err.message;
        errorResponse.stack = err.stack;
    }
    
    res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource could not be found.',
        timestamp: new Date().toISOString(),
        path: req.url
    });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`VibeSheets production server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
});

// Increase server timeout for long-running requests
server.timeout = 30000; // 30 seconds

module.exports = app;