const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const FRONTEND_DIR = path.join(__dirname, 'Frontend');

// MIME types mapping
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    let filePath = path.join(FRONTEND_DIR, req.url === '/' ? 'index.html' : req.url);
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(FRONTEND_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        // Get file extension and corresponding MIME type
        const ext = path.extname(filePath);
        const mimeType = mimeTypes[ext] || 'text/plain';
        
        // Read and serve the file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Internal server error');
                return;
            }
            
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            });
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`VibeSheets server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Try stopping other servers first.`);
    } else {
        console.error('Server error:', err);
    }
});