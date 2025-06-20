/**
 * Unified Cache Service Implementation
 * 
 * This module provides a unified caching solution to eliminate code duplication
 * across MemoryManager, TaskManager, and ContextManager. It's based on the
 * existing LRUCache implementation from utils.ts with additional features.
 */
import { LRUCache } from './utils';
import { Logger } from './logger';
import { CacheConfig, CacheStats } from './types';

/**
 * Unified Cache Service Interface
 */
export interface ICacheService<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): boolean;
  clear(): void;
  has(key: K): boolean;
  size(): number;
  getStats(): CacheStats;
}

/**
 * Cache Service Implementation
 * 
 * Provides a unified caching interface that wraps the LRUCache implementation
 * with additional functionality and consistent API across all managers.
 */
export class CacheService<K, V> implements ICacheService<K, V> {
  private cache: LRUCache<K, V>;
  private logger?: Logger;

  /**
   * Constructor
   * @param config Cache configuration
   * @param logger Optional logger instance
   */
  constructor(config: CacheConfig, logger?: Logger) {
    this.cache = new LRUCache<K, V>(config.maxSize, config.ttlMs, logger);
    this.logger = logger;
    
    this.logger?.debug('CacheService created', {
      maxSize: config.maxSize,
      ttlMs: config.ttlMs
    });
  }

  /**
   * Get cached item
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  /**
   * Set cached item
   * @param key Cache key
   * @param value Value to cache
   */
  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  /**
   * Delete cached item
   * @param key Cache key
   * @returns true if item was deleted, false if not found
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached items
   */
  clear(): void {
    this.cache.clear();
    this.logger?.debug('Cache cleared');
  }

  /**
   * Check if key exists in cache
   * @param key Cache key
   * @returns true if key exists and not expired
   */
  has(key: K): boolean {
    return this.cache.get(key) !== undefined;
  }

  /**
   * Get current cache size
   * @returns Number of cached items
   */
  size(): number {
    return this.cache.size();
  }

  /**
   * Get cache statistics
   * @returns Cache hit/miss statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Get cache configuration info for debugging
   */
  getInfo(): { size: number; stats: CacheStats } {
    return {
      size: this.size(),
      stats: this.getStats()
    };
  }
}

/**
 * Cache Service Factory
 * 
 * Creates CacheService instances with consistent configuration
 */
export class CacheServiceFactory {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Create a new cache service instance
   * @param config Cache configuration
   * @returns New CacheService instance
   */
  create<K, V>(config: CacheConfig): CacheService<K, V> {
    return new CacheService<K, V>(config, this.logger);
  }

  /**
   * Create cache service with default configuration
   * @param maxSize Maximum cache size
   * @param ttlMs TTL in milliseconds
   * @returns New CacheService instance
   */
  createDefault<K, V>(maxSize: number = 100, ttlMs: number = 3600000): CacheService<K, V> {
    return this.create<K, V>({ maxSize, ttlMs });
  }
}