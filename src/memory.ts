/**
 * Memory Management Module
 * 
 * Refactored to use unified CacheService instead of duplicate SimpleCache implementation.
 * Maintains the existing API while eliminating code duplication.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import * as crypto from 'crypto';
import { Memory, AddMemoryArgs, SearchMemoryArgs, ListMemoriesArgs, DeleteMemoryArgs } from './types';
import { CacheService } from './cache';

/**
 * Memory Manager Class
 * 
 * Combines the functionality of MemoryService and MemoryStorage into a single class,
 * simplifies the architecture, reduces layers and dependencies.
 */
export class MemoryManager {
  private storagePath: string;
  private cache: CacheService<string, Memory>;
  private console: Console;

  /**
   * Constructor
   * @param storagePath Storage path
   * @param cacheService Unified cache service instance
   * @param console Console for logging (optional)
   */
  constructor(
    storagePath: string, 
    cacheService: CacheService<string, Memory>,
    console: Console = global.console
  ) {
    this.storagePath = storagePath;
    this.cache = cacheService;
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
   * Add memory
   * @param args Add memory parameters
   */
  async addMemory(args: AddMemoryArgs): Promise<Memory> {
    try {
      // Basic validation
      if (!args.content) throw new Error('Content is required');
      if (!args.summary) throw new Error('Summary is required');
      
      // Simplified parameter handling
      const content = args.content.substring(0, 10000).replace(/[<>]/g, '');
      const summary = args.summary.substring(0, 200).replace(/[<>]/g, '');
      const tags = Array.isArray(args.tags) ? args.tags.map(tag => String(tag).substring(0, 50).replace(/[<>]/g, '')) : [];
      
      const memory: Memory = {
        id: crypto.randomUUID(),
        content,
        summary,
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags,
          context_id: args.context_id
        }
      };
      
      await this.save(memory.id, memory);
      return memory;
    } catch (error) {
      this.console.error('Failed to add memory:', error);
      throw error;
    }
  }

  /**
   * Search memory
   * @param args Search parameters
   */
  async searchMemory(args: SearchMemoryArgs): Promise<Array<{ memory: Memory, similarity: number }>> {
    try {
      if (!args.query) throw new Error('Query is required');
      
      const query = args.query.toLowerCase();
      const limit = args.limit || 10;
      const memories = await this.list();
      
      const results = memories
        .map(memory => {
          const contentMatch = memory.content.toLowerCase().includes(query);
          const summaryMatch = memory.summary.toLowerCase().includes(query);
          const tagMatch = memory.metadata.tags.some(tag => tag.toLowerCase().includes(query));
          
          if (contentMatch || summaryMatch || tagMatch) {
            return {
              memory,
              similarity: 0.9
            };
          }
          
          return {
            memory,
            similarity: this.calculateSimpleSimilarity(query, memory.content.toLowerCase(), memory.summary.toLowerCase())
          };
        })
        .filter(result => result.similarity > 0.01)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      return results;
    } catch (error) {
      this.console.error('Failed to search memory:', error);
      throw error;
    }
  }

  /**
   * List memories
   * @param args List parameters
   */
  async listMemories(args?: ListMemoriesArgs): Promise<Memory[]> {
    try {
      let memories = await this.list();
      
      // Filter by tags if specified
      if (args?.tags && args.tags.length > 0) {
        memories = memories.filter(memory => 
          args.tags!.some(tag => memory.metadata.tags.includes(tag))
        );
      }
      
      // Sort by update time (newest first)
      memories.sort((a, b) => {
        const dateA = new Date(a.metadata.updated_at).getTime();
        const dateB = new Date(b.metadata.updated_at).getTime();
        return dateB - dateA;
      });
      
      return memories;
    } catch (error) {
      this.console.error('Failed to list memories:', error);
      throw error;
    }
  }

  /**
   * Get memory
   * @param id Memory ID
   */
  async getMemory(id: string): Promise<Memory | null> {
    if (!id) throw new Error('ID is required');
    return this.load(id);
  }

  /**
   * Update memory
   * @param id Memory ID
   * @param updates Update content
   */
  async updateMemory(id: string, updates: Partial<{ content: string, summary: string, tags: string[] }>): Promise<Memory | null> {
    try {
      if (!id) throw new Error('ID is required');
      
      const memory = await this.load(id);
      if (!memory) return null;
      
      if (updates.content !== undefined) {
        memory.content = updates.content.substring(0, 10000).replace(/[<>]/g, '');
      }
      
      if (updates.summary !== undefined) {
        memory.summary = updates.summary.substring(0, 200).replace(/[<>]/g, '');
      }
      
      if (updates.tags !== undefined) {
        memory.metadata.tags = Array.isArray(updates.tags) 
          ? updates.tags.map(tag => String(tag).substring(0, 50).replace(/[<>]/g, ''))
          : [];
      }
      
      memory.metadata.updated_at = new Date().toISOString();
      
      await this.save(memory.id, memory);
      return memory;
    } catch (error) {
      this.console.error('Failed to update memory:', error);
      throw error;
    }
  }

  /**
   * Delete memory
   * @param args Delete parameters
   */
  async deleteMemory(args: DeleteMemoryArgs): Promise<boolean> {
    try {
      if (!args.id) throw new Error('ID is required');
      return this.delete(args.id);
    } catch (error) {
      this.console.error('Failed to delete memory:', error);
      throw error;
    }
  }

  /**
   * Get memories by context ID
   * @param contextId Context ID
   */
  async getMemoriesByContextId(contextId: string): Promise<Memory[]> {
    try {
      if (!contextId) throw new Error('Context ID is required');
      
      const memories = await this.list();
      return memories.filter(memory => memory.metadata.context_id === contextId);
    } catch (error) {
      this.console.error('Failed to get memories by context ID:', error);
      throw error;
    }
  }

  /**
   * Batch get memories
   * @param ids Array of IDs
   */
  async batchGetMemories(ids: string[]): Promise<Memory[]> {
    try {
      if (!Array.isArray(ids)) throw new Error('IDs must be an array');
      
      const memories: Memory[] = [];
      for (const id of ids) {
        const memory = await this.load(id);
        if (memory) memories.push(memory);
      }
      
      return memories;
    } catch (error) {
      this.console.error('Failed to batch get memories:', error);
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
   * Save memory
   * @param id Memory ID
   * @param memory Memory object
   */
  private async save(id: string, memory: Memory): Promise<void> {
    const filePath = path.join(this.storagePath, `${id}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(memory, null, 2));
      this.cache.set(id, memory);
    } catch (error) {
      throw new Error(`Failed to save memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load memory
   * @param id Memory ID
   */
  private async load(id: string): Promise<Memory | null> {
    // Check cache
    const cachedMemory = this.cache.get(id);
    if (cachedMemory) {
      return cachedMemory;
    }
    
    try {
      const filePath = path.join(this.storagePath, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const memory = JSON.parse(content) as Memory;
      
      // Update cache
      this.cache.set(id, memory);
      return memory;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      
      this.console.error(`Failed to load memory ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete memory
   * @param id Memory ID
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
      
      this.console.error(`Failed to delete memory ${id}:`, error);
      return false;
    }
  }

  /**
   * List all memories
   */
  private async list(): Promise<Memory[]> {
    try {
      const files = await fs.readdir(this.storagePath);
      const memories: Memory[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const memory = await this.load(id);
          if (memory) memories.push(memory);
        }
      }
      
      return memories;
    } catch (error) {
      this.console.error('Failed to list memories:', error);
      return [];
    }
  }

  /**
   * Calculate simple similarity
   * Simplified version of similarity calculation, not using complex TF-IDF algorithm
   */
  private calculateSimpleSimilarity(query: string, content: string, summary: string): number {
    // Split text into words
    const queryWords = new Set(query.split(/\s+/).filter(word => word.length > 0));
    const contentWords = new Set(content.split(/\s+/).filter(word => word.length > 0));
    const summaryWords = new Set(summary.split(/\s+/).filter(word => word.length > 0));
    
    // Calculate overlapping word count
    let contentOverlap = 0;
    let summaryOverlap = 0;
    
    queryWords.forEach(word => {
      if (contentWords.has(word)) contentOverlap++;
      if (summaryWords.has(word)) summaryOverlap++;
    });
    
    // Calculate similarity
    const contentSimilarity = queryWords.size > 0 ? contentOverlap / queryWords.size : 0;
    const summarySimilarity = queryWords.size > 0 ? summaryOverlap / queryWords.size : 0;
    
    // Return maximum similarity
    return Math.max(contentSimilarity, summarySimilarity);
  }
}
