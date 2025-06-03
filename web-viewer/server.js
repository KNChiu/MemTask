const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { getConfig } = require('../dist/src/config');
const { MemoryManager } = require('../dist/src/memory');
const { TaskManager } = require('../dist/src/task');
const { ContextManager } = require('../dist/src/context');

// Configuration
const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize MCP data managers
const config = getConfig();
const logger = console;
const memoryManager = new MemoryManager(
  config.memoriesPath, 
  config.cache.memory.maxSize, 
  logger
);
const taskManager = new TaskManager(
  config.tasksPath, 
  config.cache.task.maxSize, 
  logger
);
const contextManager = new ContextManager(
  config.contextsPath, 
  config.cache.context.maxSize, 
  logger
);

// Initialize data managers
(async () => {
  try {
    await memoryManager.initialize();
    await taskManager.initialize();
    await contextManager.initialize();
    console.log('MCP data managers initialized successfully');
  } catch (error) {
    console.error('Failed to initialize MCP data managers:', error);
    process.exit(1);
  }
})();

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
      const pathParts = endpoint.split('/');
      let data = {};
      
      switch (endpoint) {
        case 'overview':
          try {
            const memories = await memoryManager.listMemories();
            const tasks = await taskManager.listTasks();
            const contexts = await contextManager.listContextSnapshots();
            const activeTasks = tasks.filter(task => 
              task.status === 'todo' || task.status === 'in_progress'
            ).length;
            
            data = {
              memoriesCount: memories.length,
              tasksCount: tasks.length,
              contextsCount: contexts.length,
              activeTasks: activeTasks
            };
          } catch (error) {
            console.error('Failed to load overview data:', error);
            data = { error: 'Failed to load overview data' };
          }
          break;
        case 'tasks':
          try {
            const tasks = await taskManager.listTasks();
            data = tasks.map(task => ({
              id: task.id,
              title: task.title,
              status: task.status,
              priority: task.priority
            }));
          } catch (error) {
            console.error('Failed to load tasks:', error);
            data = { error: 'Failed to load tasks' };
          }
          break;
        case 'memories':
          try {
            const memories = await memoryManager.listMemories();
            data = memories.map(memory => ({
              id: memory.id,
              summary: memory.summary,
              created_at: memory.metadata.created_at
            }));
          } catch (error) {
            console.error('Failed to load memories:', error);
            data = { error: 'Failed to load memories' };
          }
          break;
        case 'contexts':
          try {
            const contexts = await contextManager.listContextSnapshots();
            data = contexts.map(context => ({
              id: context.id,
              summary: context.summary,
              created_at: context.created_at
            }));
          } catch (error) {
            console.error('Failed to load contexts:', error);
            data = { error: 'Failed to load contexts' };
          }
          break;
        default:
          // Handle detailed view endpoints (e.g., tasks/id, memories/id, contexts/id)
          if (pathParts.length === 2) {
            const [type, id] = pathParts;
            
            switch (type) {
              case 'tasks':
                try {
                  const task = await taskManager.getTaskStatus({ id });
                  if (task) {
                    // Ensure ID is included in the response
                    data = {
                      ...task,
                      id: task.id || id
                    };
                    console.log('Task details:', data); // Debug log
                  } else {
                    data = { error: 'Task not found' };
                  }
                } catch (error) {
                  console.error('Failed to load task details:', error);
                  data = { error: 'Failed to load task details' };
                }
                break;
              case 'memories':
                try {
                  const memory = await memoryManager.getMemory(id);
                  if (memory) {
                    // Ensure ID is included in the response
                    data = {
                      ...memory,
                      id: memory.id || id
                    };
                    console.log('Memory details:', data); // Debug log
                  } else {
                    data = { error: 'Memory not found' };
                  }
                } catch (error) {
                  console.error('Failed to load memory details:', error);
                  data = { error: 'Failed to load memory details' };
                }
                break;
              case 'contexts':
                try {
                  const context = await contextManager.getContextSnapshot(id);
                  if (context) {
                    // Ensure ID is included in the response
                    data = {
                      ...context,
                      id: context.id || id
                    };
                    console.log('Context details:', data); // Debug log
                  } else {
                    data = { error: 'Context not found' };
                  }
                } catch (error) {
                  console.error('Failed to load context details:', error);
                  data = { error: 'Failed to load context details' };
                }
                break;
              default:
                data = { error: 'Unknown detail endpoint' };
            }
          } else {
            data = { error: 'Unknown endpoint' };
          }
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

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast function to send updates to all connected clients
function broadcastUpdate(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        clients.delete(client);
      }
    } else {
      clients.delete(client);
    }
  });
  
  console.log(`Broadcasted ${type} update to ${clients.size} clients`);
}

// File system watcher for dataDir
function setupFileWatcher() {
  const dataDir = config.dataDir;
  
  console.log(`Setting up file watcher for: ${dataDir}`);
  
  // Check if directory exists
  if (!fs.existsSync(dataDir)) {
    console.error(`Data directory does not exist: ${dataDir}`);
    return;
  }
  
  // Watch subdirectories individually for better compatibility
  const subdirs = ['memories', 'tasks', 'contexts'];
  
  subdirs.forEach(subdir => {
    const subdirPath = path.join(dataDir, subdir);
    
    if (!fs.existsSync(subdirPath)) {
      console.log(`Creating missing directory: ${subdirPath}`);
      fs.mkdirSync(subdirPath, { recursive: true });
    }
    
    console.log(`Setting up watcher for: ${subdirPath}`);
    
    try {
      const watcher = fs.watch(subdirPath, { persistent: true }, (eventType, filename) => {
        console.log(`File system event in ${subdir}: ${eventType} - ${filename || 'unknown'}`);
        
        if (filename) {
          const fullPath = path.join(subdirPath, filename);
          console.log(`Full path: ${fullPath}`);
          console.log(`Event type: ${eventType}`);
          
          // Broadcast the update to all connected clients
          broadcastUpdate(subdir, {
            eventType,
            filename,
            path: fullPath,
            directory: subdir
          });
        } else {
          // If filename is null, still broadcast a general update
          console.log(`File change detected in ${subdir} but filename is null`);
          broadcastUpdate(subdir, {
            eventType,
            filename: null,
            path: subdirPath,
            directory: subdir
          });
        }
      });
      
      watcher.on('error', (error) => {
        console.error(`File watcher error for ${subdir}:`, error);
      });
      
      console.log(`File watcher setup completed for ${subdir}`);
    } catch (error) {
      console.error(`Failed to setup file watcher for ${subdir}:`, error);
    }
  });
  
  // Also set up a fallback polling method for additional reliability
  setupPollingWatcher(dataDir);
}

// Fallback polling watcher
function setupPollingWatcher(dataDir) {
  let lastScan = {};
  
  const scanDirectory = () => {
    const subdirs = ['memories', 'tasks', 'contexts'];
    
    subdirs.forEach(subdir => {
      const subdirPath = path.join(dataDir, subdir);
      
      if (fs.existsSync(subdirPath)) {
        try {
          const files = fs.readdirSync(subdirPath);
          const currentScan = files.map(file => {
            const filePath = path.join(subdirPath, file);
            const stats = fs.statSync(filePath);
            return {
              name: file,
              mtime: stats.mtime.getTime(),
              size: stats.size
            };
          });
          
          const lastScanForDir = lastScan[subdir] || [];
          
          // Check for changes
          const hasChanges = currentScan.length !== lastScanForDir.length ||
            currentScan.some((file, index) => {
              const lastFile = lastScanForDir[index];
              return !lastFile || file.name !== lastFile.name || 
                     file.mtime !== lastFile.mtime || file.size !== lastFile.size;
            });
          
          if (hasChanges && lastScanForDir.length > 0) {
            console.log(`Polling detected changes in ${subdir}`);
            broadcastUpdate(subdir, {
              eventType: 'change',
              filename: 'polling-detected',
              path: subdirPath,
              directory: subdir,
              method: 'polling'
            });
          }
          
          lastScan[subdir] = currentScan;
        } catch (error) {
          console.error(`Error scanning directory ${subdir}:`, error);
        }
      }
    });
  };
  
  // Initial scan
  scanDirectory();
  
  // Poll every 2 seconds
  setInterval(scanDirectory, 2000);
  
  console.log('Polling watcher setup completed');
}

// Start server
server.listen(PORT, () => {
  console.log(`MemTask Web Viewer running at http://localhost:${PORT}/`);
  console.log(`Serving static files from: ${PUBLIC_DIR}`);
  
  // Setup file watcher after server starts
  setupFileWatcher();
});
