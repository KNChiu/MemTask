/**
 * MemTask Dashboard Server
 * Static file server with JSON data API endpoints
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

// Configuration
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.MCP_DATA_DIR || path.join(__dirname, '../mcp_data');
const WEB_DIR = __dirname;

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// File modification timestamps cache
const fileTimestamps = new Map();

/**
 * Read all JSON files from a directory
 */
async function readJSONFiles(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const data = [];
    for (const file of jsonFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const json = JSON.parse(content);
        data.push(json);

        // Update timestamp cache
        const stats = await fs.stat(filePath);
        fileTimestamps.set(`${path.basename(dirPath)}/${file}`, stats.mtime);
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
      }
    }
    return data;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
    return [];
  }
}

/**
 * API: Get all goals
 */
async function getGoals() {
  const goalsDir = path.join(DATA_DIR, 'goals');
  const goals = await readJSONFiles(goalsDir);
  return {
    success: true,
    data: goals,
    timestamp: new Date().toISOString()
  };
}

/**
 * API: Get all tasks
 */
async function getTasks() {
  const tasksDir = path.join(DATA_DIR, 'tasks');
  const tasks = await readJSONFiles(tasksDir);
  return {
    success: true,
    data: tasks,
    timestamp: new Date().toISOString()
  };
}

/**
 * API: Get all memories
 */
async function getMemories() {
  const memoriesDir = path.join(DATA_DIR, 'memories');
  const memories = await readJSONFiles(memoriesDir);
  return {
    success: true,
    data: memories,
    timestamp: new Date().toISOString()
  };
}

/**
 * API: Get changed files since timestamp
 */
async function getChanges(sinceTimestamp) {
  const since = new Date(sinceTimestamp);
  const changes = { goals: [], tasks: [], memories: [] };

  for (const [file, mtime] of fileTimestamps.entries()) {
    if (mtime > since) {
      const [type, filename] = file.split('/');
      if (changes[type]) {
        changes[type].push(filename);
      }
    }
  }

  return {
    success: true,
    changes,
    timestamp: new Date().toISOString()
  };
}

/**
 * Serve static files
 */
async function serveStaticFile(filePath, res) {
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // API Routes
    if (pathname === '/api/goals') {
      const result = await getGoals();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    }
    else if (pathname === '/api/tasks') {
      const result = await getTasks();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    }
    else if (pathname === '/api/memories') {
      const result = await getMemories();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    }
    else if (pathname === '/api/changes') {
      const since = parsedUrl.query.since || new Date(0).toISOString();
      const data = await getChanges(since);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }
    // Static Files
    else {
      let filePath = path.join(WEB_DIR, pathname === '/' ? 'index.html' : pathname);

      // Security: prevent directory traversal
      if (!filePath.startsWith(WEB_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
      }

      await serveStaticFile(filePath, res);
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`MemTask Dashboard server running at http://localhost:${PORT}/`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Press Ctrl+C to stop`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
