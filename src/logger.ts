/**
 * Logging System
 */
import { SystemConfig } from './config';

/**
 * Log Levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log Formats
 */
export type LogFormat = 'simple' | 'json';

/**
 * Logger Interface
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

/**
 * Logger Implementation
 */
export class LoggerImpl implements Logger {
  private level: LogLevel;
  private format: LogFormat;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: SystemConfig) {
    this.level = config.logging.level;
    this.format = config.logging.format;
  }

  /**
   * Check if the specified log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }

  /**
   * Format log message
   */
  private formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error): string {
    const timestamp = new Date().toISOString();
    
    if (this.format === 'json') {
      const logObject: Record<string, unknown> = {
        timestamp,
        level,
        message,
        ...meta,
      };
      
      if (error) {
        logObject.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }
      
      return JSON.stringify(logObject);
    } else {
      // Simple format
      let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      
      if (meta && Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      
      if (error) {
        log += `\n${error.stack || error.message}`;
      }
      
      return log;
    }
  }

  /**
   * Log debug level message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatLog('debug', message, meta));
    }
  }

  /**
   * Log info level message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatLog('info', message, meta));
    }
  }

  /**
   * Log warn level message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, meta));
    }
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, meta, error));
    }
  }
}

/**
 * Create logger
 */
export function createLogger(config: SystemConfig): Logger {
  return new LoggerImpl(config);
}
