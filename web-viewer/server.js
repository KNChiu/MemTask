const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { getConfig } = require('../dist/src/config');
const { MemoryManager } = require('../dist/src/memory');
const { TaskManager } = require('../dist/src/task');
const { ContextManager } = require('../dist/src/context');
const { CacheServiceFactory } = require('../dist/src/cache');

// Configuration
const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize MCP data managers
const config = getConfig();
const logger = console;

// Create cache service factory
const cacheFactory = new CacheServiceFactory(logger);

// Create cache services for each manager
const memoryCacheService = cacheFactory.create(config.cache.memory);
const taskCacheService = cacheFactory.create(config.cache.task);
const contextCacheService = cacheFactory.create(config.cache.context);

// Initialize managers with cache services
const memoryManager = new MemoryManager(
  config.memoriesPath,
  memoryCacheService,
  logger
);
const taskManager = new TaskManager(
  config.tasksPath,
  taskCacheService,
  logger
);
const contextManager = new ContextManager(
  config.contextsPath,
  contextCacheService,
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
            console.log('API /tasks - First task from TaskManager:', JSON.stringify(tasks[0], null, 2));
            data = tasks;
            console.log('API /tasks - First task being sent to client:', JSON.stringify(data[0], null, 2));
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
      const jsonString = JSON.stringify(data, null, 2);
      console.log('Final JSON response length:', jsonString.length);
      if (endpoint === 'tasks' && data.length > 0) {
        console.log('First task in final JSON:', JSON.stringify(data[0], null, 2));
      }
      res.end(jsonString);
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
  clients.add(ws);
  
  ws.on('close', () => {
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Clear cache for specific managers based on file changes
function clearManagerCaches(type, filename) {
  try {
    switch (type) {
      case 'memories':
        if (filename && filename.endsWith('.json')) {
          const id = filename.replace('.json', '');
          if (memoryManager.cache && typeof memoryManager.cache.delete === 'function') {
            memoryManager.cache.delete(id);
          }
          // Clear entire cache if we can't target specific item
          if (memoryManager.cache && typeof memoryManager.cache.clear === 'function') {
            memoryManager.cache.clear();
          }
        }
        break;
      case 'tasks':
        if (filename && filename.endsWith('.json')) {
          const id = filename.replace('.json', '');
          if (taskManager.cache && typeof taskManager.cache.delete === 'function') {
            taskManager.cache.delete(id);
          }
          // Clear entire cache if we can't target specific item
          if (taskManager.cache && typeof taskManager.cache.clear === 'function') {
            taskManager.cache.clear();
          }
        }
        break;
      case 'contexts':
        if (filename && filename.endsWith('.json')) {
          const id = filename.replace('.json', '');
          if (contextManager.cache && typeof contextManager.cache.delete === 'function') {
            contextManager.cache.delete(id);
          }
          // Clear entire cache if we can't target specific item
          if (contextManager.cache && typeof contextManager.cache.clear === 'function') {
            contextManager.cache.clear();
          }
        }
        break;
    }
  } catch (error) {
    console.error(`Error clearing cache for ${type}:`, error);
  }
}

// Broadcast function to send updates to all connected clients
function broadcastUpdate(type, data) {
  // Clear caches before broadcasting updates
  clearManagerCaches(type, data.filename);
  
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
}

// File system watcher for dataDir
function setupFileWatcher() {
  const dataDir = config.dataDir;
  
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
      fs.mkdirSync(subdirPath, { recursive: true });
    }
    
    try {
      const watcher = fs.watch(subdirPath, { persistent: true }, (eventType, filename) => {
        if (filename) {
          const fullPath = path.join(subdirPath, filename);
          
          // Broadcast the update to all connected clients
          broadcastUpdate(subdir, {
            eventType,
            filename,
            path: fullPath,
            directory: subdir
          });
        } else {
          // If filename is null, still broadcast a general update
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
          const currentScan = {};
          
          // Build current scan as a map with filename as key
          files.forEach(file => {
            const filePath = path.join(subdirPath, file);
            try {
              const stats = fs.statSync(filePath);
              currentScan[file] = {
                name: file,
                mtime: stats.mtime.getTime(),
                ctime: stats.ctime.getTime(), // Change time
                size: stats.size,
                isFile: stats.isFile()
              };
            } catch (statError) {
              // Ignore stat errors for cleanup
            }
          });
          
          const lastScanForDir = lastScan[subdir] || {};
          
          // Check for changes by comparing file maps
          let hasChanges = false;
          let changedFiles = [];
          
          // Check for new or modified files
          Object.keys(currentScan).forEach(filename => {
            const currentFile = currentScan[filename];
            const lastFile = lastScanForDir[filename];
            
            if (!lastFile) {
              // New file
              hasChanges = true;
              changedFiles.push({ name: filename, change: 'added' });
            } else if (
              currentFile.mtime !== lastFile.mtime || 
              currentFile.ctime !== lastFile.ctime ||
              currentFile.size !== lastFile.size
            ) {
              // Modified file
              hasChanges = true;
              changedFiles.push({ name: filename, change: 'modified' });
            }
          });
          
          // Check for deleted files
          Object.keys(lastScanForDir).forEach(filename => {
            if (!currentScan[filename]) {
              hasChanges = true;
              changedFiles.push({ name: filename, change: 'deleted' });
            }
          });
          
          if (hasChanges && Object.keys(lastScanForDir).length > 0) {
            broadcastUpdate(subdir, {
              eventType: 'change',
              filename: 'polling-detected',
              path: subdirPath,
              directory: subdir,
              method: 'polling',
              changes: changedFiles
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
  
  // Poll every 1 second for better responsiveness
  setInterval(scanDirectory, 1000);
}

// Start server
server.listen(PORT, () => {
  console.log(`MemTask Web Viewer running at http://localhost:${PORT}/`);
  console.log(`Serving static files from: ${PUBLIC_DIR}`);
  
  // Setup file watcher after server starts
  setupFileWatcher();
});
