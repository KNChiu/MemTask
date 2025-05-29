const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Serve static files
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    const filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).substring(1);
      const contentType = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json'
      }[ext] || 'text/plain';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  
  // Handle API requests - Mock data for demo
  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    try {
      const endpoint = url.pathname.replace('/api/', '');
      let data = {};
      
      switch (endpoint) {
        case 'overview':
          data = {
            memoriesCount: 0,
            tasksCount: 7,
            contextsCount: 3,
            activeTasks: 0
          };
          break;
        case 'tasks':
          data = [
            { id: '1', title: 'Create project structure for web viewer', status: 'completed', priority: 'high' },
            { id: '2', title: 'Implement HTTP server for web viewer', status: 'completed', priority: 'high' },
            { id: '3', title: 'Develop dashboard UI', status: 'completed', priority: 'medium' },
            { id: '4', title: 'Implement task viewing panel', status: 'completed', priority: 'medium' }
          ];
          break;
        case 'memories':
          data = [];
          break;
        case 'contexts':
          data = [
            { id: '1', summary: 'Successfully resolved npm run dev error', created_at: '2025-05-29T05:27:49.261Z' },
            { id: '2', summary: 'SQL Agent MCP implementation', created_at: '2025-05-29T03:08:08.511Z' },
            { id: '3', summary: 'Sample question tool implementation', created_at: '2025-05-29T01:53:56.092Z' }
          ];
          break;
        default:
          data = { error: 'Unknown endpoint' };
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (error) {
      console.error('API Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // Not found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start server
server.listen(PORT, () => {
  console.log(`MemTask Web Viewer running at http://localhost:${PORT}/`);
  console.log(`Serving static files from: ${PUBLIC_DIR}`);
});
