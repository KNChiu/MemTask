#!/usr/bin/env node

/**
 * Entry File
 */
import { getConfig } from './config';
import { createLogger } from './logger';
import { MemoryContextServer } from './server';

/**
 * Main Function
 */
async function main() {
  try {
    // Get configuration
    const config = getConfig();
    
    // Create logger
    const logger = createLogger(config);
    
    logger.info('Starting Memory Context Server', {
      dataDir: config.dataDir,
      logLevel: config.logging.level
    });
    
    // Create and initialize server
    const server = new MemoryContextServer(config, logger);
    await server.initialize();
    
    // Run server
    await server.run();
  } catch (error) {
    console.error('Server startup failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Execute main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
