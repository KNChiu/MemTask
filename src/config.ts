/**
 * Configuration Management
 */
import * as path from 'path';

/**
 * System Configuration Interface
 */
export interface SystemConfig {
  dataDir: string;
  memoriesPath: string;
  tasksPath: string;
  contextsPath: string;
  cache: {
    memory: {
      maxSize: number;
      ttlMs: number;
    };
    task: {
      maxSize: number;
      ttlMs: number;
    };
    context: {
      maxSize: number;
      ttlMs: number;
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'simple' | 'json';
  };
}

/**
 * Parse command line arguments for data directory
 */
function parseDataDirFromArgs(): string | null {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --data-dir=<path> format
    if (arg.startsWith('--data-dir=')) {
      const value = arg.split('=')[1];
      return value && value.trim() ? value.trim() : null;
    }

    // Handle --data-dir <path> format
    if (arg === '--data-dir' && i + 1 < args.length) {
      const value = args[i + 1];
      return value && value.trim() ? value.trim() : null;
    }
  }

  return null;
}
/**
 * Default Configuration
 */
export const defaultConfig: SystemConfig = {
  dataDir: parseDataDirFromArgs() || process.env.MCP_DATA_DIR || path.join(process.cwd(), 'mcp_data'),
  memoriesPath: '',  // Will be set in getConfig
  tasksPath: '',     // Will be set in getConfig
  contextsPath: '',  // Will be set in getConfig
  cache: {
    memory: {
      maxSize: 1000,  // Cache up to 1000 memory items
      ttlMs: 3600000, // Cache expiration time: 1 hour
    },
    task: {
      maxSize: 500,   // Cache up to 500 task items
      ttlMs: 3600000, // Cache expiration time: 1 hour
    },
    context: {
      maxSize: 200,   // Cache up to 200 context snapshots
      ttlMs: 3600000, // Cache expiration time: 1 hour
    },
  },
  logging: {
    level: 'info',
    format: 'simple',
  },
};

/**
 * Get System Configuration
 */
export function getConfig(): SystemConfig {
  const config = { ...defaultConfig };
  
  // Set paths
  config.memoriesPath = path.join(config.dataDir, 'memories');
  config.tasksPath = path.join(config.dataDir, 'tasks');
  config.contextsPath = path.join(config.dataDir, 'contexts');
  
  // Override configuration from environment variables
  if (process.env.MCP_CACHE_MEMORY_MAX_SIZE) {
    config.cache.memory.maxSize = parseInt(process.env.MCP_CACHE_MEMORY_MAX_SIZE, 10);
  }
  
  if (process.env.MCP_CACHE_MEMORY_TTL) {
    config.cache.memory.ttlMs = parseInt(process.env.MCP_CACHE_MEMORY_TTL, 10);
  }
  
  if (process.env.MCP_CACHE_TASK_MAX_SIZE) {
    config.cache.task.maxSize = parseInt(process.env.MCP_CACHE_TASK_MAX_SIZE, 10);
  }
  
  if (process.env.MCP_CACHE_TASK_TTL) {
    config.cache.task.ttlMs = parseInt(process.env.MCP_CACHE_TASK_TTL, 10);
  }
  
  if (process.env.MCP_CACHE_CONTEXT_MAX_SIZE) {
    config.cache.context.maxSize = parseInt(process.env.MCP_CACHE_CONTEXT_MAX_SIZE, 10);
  }
  
  if (process.env.MCP_CACHE_CONTEXT_TTL) {
    config.cache.context.ttlMs = parseInt(process.env.MCP_CACHE_CONTEXT_TTL, 10);
  }
  
  if (process.env.MCP_LOG_LEVEL && ['debug', 'info', 'warn', 'error'].includes(process.env.MCP_LOG_LEVEL)) {
    config.logging.level = process.env.MCP_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
  }
  
  if (process.env.MCP_LOG_FORMAT && ['simple', 'json'].includes(process.env.MCP_LOG_FORMAT)) {
    config.logging.format = process.env.MCP_LOG_FORMAT as 'simple' | 'json';
  }
  
  return config;
}

