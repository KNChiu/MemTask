/**
 * Structured Logger Module
 * Provides consistent logging with levels: ERROR, WARN, INFO, DEBUG
 */

const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(level = LogLevel.INFO) {
    this.level = level;
    this.context = 'Dashboard';
  }

  setLevel(level) {
    this.level = level;
  }

  setContext(context) {
    this.context = context;
  }

  error(message, ...args) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[${this.context}] ERROR:`, message, ...args);
    }
  }

  warn(message, ...args) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[${this.context}] WARN:`, message, ...args);
    }
  }

  info(message, ...args) {
    if (this.level >= LogLevel.INFO) {
      console.info(`[${this.context}] INFO:`, message, ...args);
    }
  }

  debug(message, ...args) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[${this.context}] DEBUG:`, message, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger(LogLevel.INFO);
export { LogLevel };
