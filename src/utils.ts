/**
 * Utility Functions
 */
import * as crypto from 'crypto';
import { Logger } from './logger';

/**
 * Generate UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate content hash
 */
export function generateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Calculate text similarity (using simplified TF-IDF algorithm)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) {
    return 0;
  }
  
  // Convert text to lowercase and tokenize
  const tokenize = (text: string): string[] => {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 0);
  };
  
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);
  
  // If either text is empty after tokenization, similarity is 0
  if (words1.length === 0 || words2.length === 0) {
    return 0;
  }
  
  // Calculate term frequency (TF)
  const calculateTF = (words: string[]): Map<string, number> => {
    const tf = new Map<string, number>();
    words.forEach(word => {
      tf.set(word, (tf.get(word) || 0) + 1);
    });
    
    // Normalize term frequency
    const wordCount = words.length;
    tf.forEach((count, word) => {
      tf.set(word, count / wordCount);
    });
    
    return tf;
  };
  
  const tf1 = calculateTF(words1);
  const tf2 = calculateTF(words2);
  
  const allWords = new Set([...tf1.keys(), ...tf2.keys()]);
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  allWords.forEach(word => {
    const weight1 = tf1.get(word) || 0;
    const weight2 = tf2.get(word) || 0;
    
    dotProduct += weight1 * weight2;
    magnitude1 += weight1 * weight1;
    magnitude2 += weight2 * weight2;
  });
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  // Cosine similarity
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Validate and sanitize string
 */
export function validateAndSanitizeString(
  input: unknown, 
  fieldName: string, 
  maxLength: number = 1000,
  logger?: Logger
): string {
  if (typeof input !== 'string') {
    const error = new Error(`${fieldName} must be a string`);
    logger?.error(`Validation failed: ${error.message}`);
    throw error;
  }
  
  if (input.length === 0) {
    const error = new Error(`${fieldName} cannot be empty`);
    logger?.error(`Validation failed: ${error.message}`);
    throw error;
  }
  
  if (input.length > maxLength) {
    const error = new Error(`${fieldName} is too long (maximum ${maxLength} characters)`);
    logger?.error(`Validation failed: ${error.message}`);
    throw error;
  }
  
  return input.replace(/[<>]/g, '');
}

/**
 * Validate and sanitize tags
 */
export function validateAndSanitizeTags(tags: unknown, logger?: Logger): string[] {
  if (!tags) {
    return [];
  }
  
  if (!Array.isArray(tags)) {
    const error = new Error('Tags must be an array');
    logger?.error(`Validation failed: ${error.message}`);
    throw error;
  }
  
  return tags.map((tag, index) => {
    if (typeof tag !== 'string') {
      const error = new Error(`Tag at index ${index} must be a string`);
      logger?.error(`Validation failed: ${error.message}`);
      throw error;
    }
    
    if (tag.length === 0) {
      const error = new Error(`Tag at index ${index} cannot be empty`);
      logger?.error(`Validation failed: ${error.message}`);
      throw error;
    }
    
    if (tag.length > 50) {
      const error = new Error(`Tag at index ${index} is too long (maximum 50 characters)`);
      logger?.error(`Validation failed: ${error.message}`);
      throw error;
    }
    
    return tag.replace(/[<>]/g, '');
  });
}

/**
 * Validate ID
 */
export function validateId(id: unknown, entityName: string, logger?: Logger): string {
  if (typeof id !== 'string') {
    const error = new Error(`${entityName} ID must be a string`);
    logger?.error(`Validation failed: ${error.message}`);
    throw error;
  }
  
  if (id.length === 0) {
    const error = new Error(`${entityName} ID cannot be empty`);
    logger?.error(`Validation failed: ${error.message}`);
    throw error;
  }
  
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    const error = new Error(`${entityName} ID contains invalid characters`);
    logger?.error(`Validation failed: ${error.message}`);
    throw error;
  }
  
  return id;
}

/**
 * Get current time as ISO string
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}

/**
 * Validate date string
 */
export function validateDateString(dateStr: string, fieldName: string, logger?: Logger): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return date.toISOString();
  } catch (error) {
    const errorMessage = `${fieldName} must be a valid date format`;
    logger?.error(errorMessage, error instanceof Error ? error : undefined);
    throw new Error(errorMessage);
  }
}

/**
 * Simple LRU cache implementation
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V, expiry: number }>;
  private maxSize: number;
  private ttlMs: number;
  private stats = { hits: 0, misses: 0 };
  private logger?: Logger;

  constructor(maxSize: number, ttlMs: number, logger?: Logger) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.logger = logger;
    
    this.logger?.debug(`Created LRU cache, max size: ${maxSize}, TTL: ${ttlMs}ms`);
  }

  /**
   * Get cache item
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.logger?.debug(`Cache miss: ${String(key)}`);
      return undefined;
    }
    
    const now = Date.now();
    
    // Check if expired
    if (item.expiry < now) {
      this.cache.delete(key);
      this.stats.misses++;
      this.logger?.debug(`Cache item expired: ${String(key)}`);
      return undefined;
    }
    
    // Update position (LRU strategy)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    this.stats.hits++;
    this.logger?.debug(`Cache hit: ${String(key)}`);
    
    return item.value;
  }

  /**
   * Set cache item
   */
  set(key: K, value: V): void {
    // If cache is full, delete the oldest item
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.logger?.debug(`Cache full, deleting oldest item: ${String(oldestKey)}`);
      }
    }
    
    const expiry = Date.now() + this.ttlMs;
    this.cache.set(key, { value, expiry });
    this.logger?.debug(`Added item to cache: ${String(key)}`);
  }

  /**
   * Delete cache item
   */
  delete(key: K): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.logger?.debug(`Deleted item from cache: ${String(key)}`);
    }
    return result;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.logger?.debug('Cleared cache');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}
