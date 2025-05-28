/**
 * Context Management Module
 * 
 * Combines the functionality of ContextService and ContextStorage,
 * simplifies the architecture, reduces over-engineering while maintaining
 * the core benefits of SOLID principles.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import * as crypto from 'crypto';
import { ContextSnapshot, CreateContextSnapshotArgs } from './types';

/**
 * Simplified cache implementation
 */
class SimpleCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private stats = { hits: 0, misses: 0 };

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value) {
      this.stats.hits++;
      // Update position (LRU strategy)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.stats.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    // If cache is full, delete the oldest item
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return { ...this.stats };
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Context Manager Class
 * 
 * Combines the functionality of ContextService and ContextStorage into a single class,
 * simplifies the architecture, reduces layers and dependencies.
 */
export class ContextManager {
  private storagePath: string;
  private cache: SimpleCache<string, ContextSnapshot>;
  private console: Console;

  /**
   * Constructor
   * @param storagePath Storage path
   * @param maxCacheSize Maximum cache size
   */
  constructor(storagePath: string, maxCacheSize: number = 100, console: Console = global.console) {
    this.storagePath = storagePath;
    this.cache = new SimpleCache<string, ContextSnapshot>(maxCacheSize);
    this.console = console;
  }

  /**
   * Initialize
   */
  async initialize(): Promise<void> {
    try {
      if (!existsSync(this.storagePath)) {
        await fs.mkdir(this.storagePath, { recursive: true });
        this.console.info(`Created storage directory: ${this.storagePath}`);
      }
    } catch (error) {
      const errorMessage = `Failed to initialize storage: ${error instanceof Error ? error.message : String(error)}`;
      this.console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Create context snapshot
   * @param args Create context snapshot parameters
   */
  async createContextSnapshot(args: CreateContextSnapshotArgs): Promise<ContextSnapshot> {
    try {
      // Basic validation
      if (!args.summary) throw new Error('Summary is required');
      if (!args.content) throw new Error('Content is required');
      
      // Simplified parameter handling
      const summary = args.summary.substring(0, 200).replace(/[<>]/g, '');
      const content = args.content.substring(0, 10000).replace(/[<>]/g, '');
      
      // Validate related memories and tasks
      const related_memories = Array.isArray(args.related_memories) ? args.related_memories.map(id => String(id)) : [];
      const related_tasks = Array.isArray(args.related_tasks) ? args.related_tasks.map(id => String(id)) : [];
      
      const context: ContextSnapshot = {
        id: crypto.randomUUID(),
        summary,
        content,
        created_at: new Date().toISOString(),
        related_memories,
        related_tasks
      };
      
      await this.save(context.id, context);
      return context;
    } catch (error) {
      this.console.error('Failed to create context snapshot:', error);
      throw error;
    }
  }

  /**
   * Get context snapshot
   * @param id Context snapshot ID
   */
  async getContextSnapshot(id: string): Promise<ContextSnapshot | null> {
    try {
      if (!id) throw new Error('ID is required');
      return this.load(id);
    } catch (error) {
      this.console.error('Failed to get context snapshot:', error);
      throw error;
    }
  }

  /**
   * List context snapshots
   */
  async listContextSnapshots(): Promise<ContextSnapshot[]> {
    try {
      const contexts = await this.list();
      
      // Sort by creation date (newest first)
      contexts.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      
      return contexts;
    } catch (error) {
      this.console.error('Failed to list context snapshots:', error);
      throw error;
    }
  }

  /**
   * Delete context snapshot
   * @param id Context snapshot ID
   */
  async deleteContextSnapshot(id: string): Promise<boolean> {
    try {
      if (!id) throw new Error('ID is required');
      return this.delete(id);
    } catch (error) {
      this.console.error('Failed to delete context snapshot:', error);
      throw error;
    }
  }

  /**
   * Search context snapshots
   * @param query Query string
   */
  async searchContextSnapshots(query: string): Promise<ContextSnapshot[]> {
    try {
      if (!query) throw new Error('Query is required');
      
      const queryLower = query.toLowerCase();
      const contexts = await this.list();
      
      return contexts.filter(context => 
        context.summary.toLowerCase().includes(queryLower) ||
        context.content.toLowerCase().includes(queryLower)
      );
    } catch (error) {
      this.console.error('Failed to search context snapshots:', error);
      throw error;
    }
  }

  /**
   * Get recent context snapshots
   * @param limit Limit count
   */
  async getRecentContextSnapshots(limit: number = 5): Promise<ContextSnapshot[]> {
    try {
      const contexts = await this.list();
      
      // Sort by creation date (newest first)
      contexts.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      
      return contexts.slice(0, limit);
    } catch (error) {
      this.console.error('Failed to get recent context snapshots:', error);
      throw error;
    }
  }

  /**
   * Get context snapshots by related memory
   * @param memoryId Memory ID
   */
  async getContextSnapshotsByMemory(memoryId: string): Promise<ContextSnapshot[]> {
    try {
      if (!memoryId) throw new Error('Memory ID is required');
      
      const contexts = await this.list();
      return contexts.filter(context => context.related_memories.includes(memoryId));
    } catch (error) {
      this.console.error('Failed to get context snapshots by related memory:', error);
      throw error;
    }
  }

  /**
   * Get context snapshots by related task
   * @param taskId Task ID
   */
  async getContextSnapshotsByTask(taskId: string): Promise<ContextSnapshot[]> {
    try {
      if (!taskId) throw new Error('Task ID is required');
      
      const contexts = await this.list();
      return contexts.filter(context => context.related_tasks.includes(taskId));
    } catch (error) {
      this.console.error('Failed to get context snapshots by related task:', error);
      throw error;
    }
  }

  /**
   * Add related memory
   * @param id Context snapshot ID
   * @param memoryId Memory ID
   */
  async addRelatedMemory(id: string, memoryId: string): Promise<boolean> {
    try {
      if (!id) throw new Error('Context ID is required');
      if (!memoryId) throw new Error('Memory ID is required');
      
      const context = await this.load(id);
      if (!context) return false;
      
      if (!context.related_memories.includes(memoryId)) {
        context.related_memories.push(memoryId);
        await this.save(id, context);
      }
      
      return true;
    } catch (error) {
      this.console.error('Failed to add related memory:', error);
      throw error;
    }
  }

  /**
   * Add related task
   * @param id Context snapshot ID
   * @param taskId Task ID
   */
  async addRelatedTask(id: string, taskId: string): Promise<boolean> {
    try {
      if (!id) throw new Error('Context ID is required');
      if (!taskId) throw new Error('Task ID is required');
      
      const context = await this.load(id);
      if (!context) return false;
      
      if (!context.related_tasks.includes(taskId)) {
        context.related_tasks.push(taskId);
        await this.save(id, context);
      }
      
      return true;
    } catch (error) {
      this.console.error('Failed to add related task:', error);
      throw error;
    }
  }

  /**
   * Remove related memory
   * @param id Context snapshot ID
   * @param memoryId Memory ID
   */
  async removeRelatedMemory(id: string, memoryId: string): Promise<boolean> {
    try {
      if (!id) throw new Error('Context ID is required');
      if (!memoryId) throw new Error('Memory ID is required');
      
      const context = await this.load(id);
      if (!context) return false;
      
      const index = context.related_memories.indexOf(memoryId);
      if (index !== -1) {
        context.related_memories.splice(index, 1);
        await this.save(id, context);
      }
      
      return true;
    } catch (error) {
      this.console.error('Failed to remove related memory:', error);
      throw error;
    }
  }

  /**
   * Remove related task
   * @param id Context snapshot ID
   * @param taskId Task ID
   */
  async removeRelatedTask(id: string, taskId: string): Promise<boolean> {
    try {
      if (!id) throw new Error('Context ID is required');
      if (!taskId) throw new Error('Task ID is required');
      
      const context = await this.load(id);
      if (!context) return false;
      
      const index = context.related_tasks.indexOf(taskId);
      if (index !== -1) {
        context.related_tasks.splice(index, 1);
        await this.save(id, context);
      }
      
      return true;
    } catch (error) {
      this.console.error('Failed to remove related task:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  // Private methods - Storage layer functionality

  /**
   * Save context
   * @param id Context ID
   * @param context Context object
   */
  private async save(id: string, context: ContextSnapshot): Promise<void> {
    const filePath = path.join(this.storagePath, `${id}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(context, null, 2));
      this.cache.set(id, context);
    } catch (error) {
      throw new Error(`Failed to save context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load context
   * @param id Context ID
   */
  private async load(id: string): Promise<ContextSnapshot | null> {
    // Check cache
    const cachedContext = this.cache.get(id);
    if (cachedContext) {
      return cachedContext;
    }
    
    try {
      const filePath = path.join(this.storagePath, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const context = JSON.parse(content) as ContextSnapshot;
      
      // Update cache
      this.cache.set(id, context);
      return context;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      
      this.console.error(`Failed to load context ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete context
   * @param id Context ID
   */
  private async delete(id: string): Promise<boolean> {
    const filePath = path.join(this.storagePath, `${id}.json`);
    try {
      await fs.unlink(filePath);
      this.cache.delete(id);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      
      this.console.error(`Failed to delete context ${id}:`, error);
      return false;
    }
  }

  /**
   * List all contexts
   */
  private async list(): Promise<ContextSnapshot[]> {
    try {
      const files = await fs.readdir(this.storagePath);
      const contexts: ContextSnapshot[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const context = await this.load(id);
          if (context) contexts.push(context);
        }
      }
      
      return contexts;
    } catch (error) {
      this.console.error('Failed to list contexts:', error);
      return [];
    }
  }
}
