/**
 * Task Management Module
 * 
 * Combines the functionality of TaskService and TaskStorage,
 * simplifies the architecture, reduces over-engineering while maintaining
 * the core benefits of SOLID principles.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import * as crypto from 'crypto';
import { Task, CreateTaskArgs, UpdateTaskArgs, GetTaskStatusArgs, ListTasksArgs, DeleteTaskArgs, SearchTaskArgs } from './types';

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
 * Task Manager Class
 * 
 * Combines the functionality of TaskService and TaskStorage into a single class,
 * simplifies the architecture, reduces layers and dependencies.
 */
export class TaskManager {
  private storagePath: string;
  private cache: SimpleCache<string, Task>;
  private console: Console;

  /**
   * Constructor
   * @param storagePath Storage path
   * @param maxCacheSize Maximum cache size
   */
  constructor(storagePath: string, maxCacheSize: number = 100, console: Console = global.console) {
    this.storagePath = storagePath;
    this.cache = new SimpleCache<string, Task>(maxCacheSize);
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
   * Create task
   * @param args Create task parameters
   */
  async createTask(args: CreateTaskArgs): Promise<Task> {
    try {
      // Basic validation
      if (!args.title) throw new Error('Title is required');
      if (!args.description) throw new Error('Description is required');
      
      // Simplified parameter handling
      const title = args.title.substring(0, 100).replace(/[<>]/g, '');
      const description = args.description.substring(0, 1000).replace(/[<>]/g, '');
      const tags = Array.isArray(args.tags) ? args.tags.map(tag => String(tag).substring(0, 50).replace(/[<>]/g, '')) : [];
      
      // Validate priority
      let priority: 'low' | 'medium' | 'high' = 'medium';
      if (args.priority) {
        if (!['low', 'medium', 'high'].includes(args.priority)) {
          throw new Error('Priority must be one of: low, medium, or high');
        }
        priority = args.priority as 'low' | 'medium' | 'high';
      }
      
      // Validate due date
      let due_date: string | undefined = undefined;
      if (args.due_date) {
        try {
          const date = new Date(args.due_date);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
          due_date = date.toISOString();
        } catch (error) {
          throw new Error('Due date must be a valid date format');
        }
      }
      
      // Validate linked memories
      let linked_memories: string[] = [];
      if (args.linked_memories && Array.isArray(args.linked_memories)) {
        linked_memories = args.linked_memories.map(id => String(id));
      }
      
      const task: Task = {
        id: crypto.randomUUID(),
        title,
        description,
        status: 'todo',
        priority,
        tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        due_date,
        linked_memories,
        progress_notes: []
      };
      
      await this.save(task.id, task);
      return task;
    } catch (error) {
      this.console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Update task
   * @param args Update task parameters
   */
  async updateTask(args: UpdateTaskArgs): Promise<Task | null> {
    try {
      if (!args) throw new Error('Arguments are required');
      if (!args.id) throw new Error('ID is required');
      
      const task = await this.load(args.id);
      if (!task) return null;
      
      // Update task properties
      if (args.status) {
        if (!['todo', 'in_progress', 'completed', 'cancelled'].includes(args.status)) {
          throw new Error('Status must be one of: todo, in_progress, completed, or cancelled');
        }
        task.status = args.status;
      }
      
      if (args.title) {
        task.title = args.title.substring(0, 100).replace(/[<>]/g, '');
      }
      
      if (args.description) {
        task.description = args.description.substring(0, 1000).replace(/[<>]/g, '');
      }
      
      if (args.priority) {
        if (!['low', 'medium', 'high'].includes(args.priority)) {
          throw new Error('Priority must be one of: low, medium, or high');
        }
        task.priority = args.priority as 'low' | 'medium' | 'high';
      }
      
      if (args.progress_note) {
        const note = args.progress_note.substring(0, 1000).replace(/[<>]/g, '');
        task.progress_notes.push(`${new Date().toISOString()}: ${note}`);
      }
      
      task.updated_at = new Date().toISOString();
      
      await this.save(task.id, task);
      return task;
    } catch (error) {
      this.console.error('Failed to update task:', error);
      throw error;
    }
  }

  /**
   * Get task status
   * @param args Get task status parameters
   */
  async getTaskStatus(args: GetTaskStatusArgs): Promise<Task | null> {
    try {
      if (!args.id) throw new Error('ID is required');
      return this.load(args.id);
    } catch (error) {
      this.console.error('Failed to get task status:', error);
      throw error;
    }
  }

  /**
   * List tasks
   * @param args List tasks parameters
   */
  async listTasks(args?: ListTasksArgs): Promise<Task[]> {
    try {
      let tasks = await this.list();
      
      // Apply filters
      if (args?.status) {
        if (!['todo', 'in_progress', 'completed', 'cancelled'].includes(args.status)) {
          throw new Error('Status must be one of: todo, in_progress, completed, or cancelled');
        }
        tasks = tasks.filter(task => task.status === args.status);
      }
      
      if (args?.priority) {
        if (!['low', 'medium', 'high'].includes(args.priority)) {
          throw new Error('Priority must be one of: low, medium, or high');
        }
        tasks = tasks.filter(task => task.priority === args.priority);
      }
      
      if (args?.tags && args.tags.length > 0) {
        tasks = tasks.filter(task => 
          args.tags!.some(tag => task.tags.includes(tag))
        );
      }
      
      // Sort by update time (newest first)
      tasks.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return dateB - dateA;
      });
      
      return tasks;
    } catch (error) {
      this.console.error('Failed to list tasks:', error);
      throw error;
    }
  }

  /**
   * Delete task
   * @param args Delete task parameters
   */
  async deleteTask(args: DeleteTaskArgs): Promise<boolean> {
    try {
      if (!args.id) throw new Error('ID is required');
      return this.delete(args.id);
    } catch (error) {
      this.console.error('Failed to delete task:', error);
      throw error;
    }
  }

  /**
   * Search tasks
   * @param args Search parameters
   */
  async searchTask(args: SearchTaskArgs): Promise<Array<{ task: Task, similarity: number }>> {
    try {
      if (!args.query) throw new Error('Query is required');
      
      const query = args.query.toLowerCase();
      const limit = args.limit || 10;
      const tasks = await this.list();
      
      const results = tasks
        .map(task => {
          const titleMatch = task.title.toLowerCase().includes(query);
          const descMatch = task.description.toLowerCase().includes(query);
          const tagMatch = task.tags.some(tag => tag.toLowerCase().includes(query));
          const notesMatch = task.progress_notes.some(note => note.toLowerCase().includes(query));
          
          if (titleMatch || descMatch || tagMatch || notesMatch) {
            return {
              task,
              similarity: 0.9
            };
          }
          
          return {
            task,
            similarity: this.calculateSimpleSimilarity(query, 
              `${task.title} ${task.description} ${task.tags.join(' ')} ${task.progress_notes.join(' ')}`)
          };
        })
        .filter(result => result.similarity > 0.01)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      return results;
    } catch (error) {
      this.console.error('Failed to search tasks:', error);
      throw error;
    }
  }

  /**
   * Calculate simple similarity score
   */
  private calculateSimpleSimilarity(query: string, text: string): number {
    const queryWords = new Set(query.split(/\s+/).filter(word => word.length > 0));
    const textWords = new Set(text.toLowerCase().split(/\s+/).filter(word => word.length > 0));
    
    let overlap = 0;
    queryWords.forEach(word => {
      if (textWords.has(word)) overlap++;
    });
    
    return queryWords.size > 0 ? overlap / queryWords.size : 0;
  }

  /**
   * Add progress note
   * @param id Task ID
   * @param note Progress note
   */
  async addProgressNote(id: string, note: string): Promise<boolean> {
    try {
      if (!id) throw new Error('ID is required');
      if (!note) throw new Error('Note is required');
      
      const task = await this.load(id);
      if (!task) return false;
      
      const sanitizedNote = note.substring(0, 1000).replace(/[<>]/g, '');
      task.progress_notes.push(`${new Date().toISOString()}: ${sanitizedNote}`);
      task.updated_at = new Date().toISOString();
      
      await this.save(id, task);
      return true;
    } catch (error) {
      this.console.error('Failed to add progress note:', error);
      throw error;
    }
  }

  /**
   * Update task status
   * @param id Task ID
   * @param status New status
   */
  async updateStatus(id: string, status: 'todo' | 'in_progress' | 'completed' | 'cancelled'): Promise<boolean> {
    try {
      if (!id) throw new Error('ID is required');
      
      if (!['todo', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        throw new Error('Status must be one of: todo, in_progress, completed, or cancelled');
      }
      
      const task = await this.load(id);
      if (!task) return false;
      
      task.status = status;
      task.updated_at = new Date().toISOString();
      
      await this.save(id, task);
      return true;
    } catch (error) {
      this.console.error('Failed to update task status:', error);
      throw error;
    }
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<Task[]> {
    try {
      const tasks = await this.list();
      const now = new Date().getTime();
      
      return tasks.filter(task => {
        if (!task.due_date) return false;
        if (task.status === 'completed' || task.status === 'cancelled') return false;
        
        const dueDate = new Date(task.due_date).getTime();
        return dueDate < now;
      });
    } catch (error) {
      this.console.error('Failed to get overdue tasks:', error);
      throw error;
    }
  }

  /**
   * Get tasks by linked memory
   * @param memoryId Memory ID
   */
  async getTasksByLinkedMemory(memoryId: string): Promise<Task[]> {
    try {
      if (!memoryId) throw new Error('Memory ID is required');
      
      const tasks = await this.list();
      return tasks.filter(task => task.linked_memories.includes(memoryId));
    } catch (error) {
      this.console.error('Failed to get tasks by linked memory:', error);
      throw error;
    }
  }

  /**
   * Batch get tasks
   * @param ids Array of task IDs
   */
  async batchGetTasks(ids: string[]): Promise<Task[]> {
    try {
      if (!Array.isArray(ids)) throw new Error('IDs must be an array');
      
      const tasks: Task[] = [];
      for (const id of ids) {
        const task = await this.load(id);
        if (task) tasks.push(task);
      }
      
      return tasks;
    } catch (error) {
      this.console.error('Failed to batch get tasks:', error);
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
   * Save task
   * @param id Task ID
   * @param task Task object
   */
  private async save(id: string, task: Task): Promise<void> {
    const filePath = path.join(this.storagePath, `${id}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(task, null, 2));
      this.cache.set(id, task);
    } catch (error) {
      throw new Error(`Failed to save task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load task
   * @param id Task ID
   */
  private async load(id: string): Promise<Task | null> {
    // Check cache
    const cachedTask = this.cache.get(id);
    if (cachedTask) {
      return cachedTask;
    }
    
    try {
      const filePath = path.join(this.storagePath, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const task = JSON.parse(content) as Task;
      
      // Update cache
      this.cache.set(id, task);
      return task;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      
      this.console.error(`Failed to load task ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete task
   * @param id Task ID
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
      
      this.console.error(`Failed to delete task ${id}:`, error);
      return false;
    }
  }

  /**
   * List all tasks
   */
  private async list(): Promise<Task[]> {
    try {
      const files = await fs.readdir(this.storagePath);
      const tasks: Task[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const task = await this.load(id);
          if (task) tasks.push(task);
        }
      }
      
      return tasks;
    } catch (error) {
      this.console.error('Failed to list tasks:', error);
      return [];
    }
  }

  /**
   * Sort tasks by priority
   * @param tasks Tasks to sort
   * @param highFirst Whether high priority comes first
   */
  private sortByPriority(tasks: Task[], highFirst: boolean = true): Task[] {
    const priorityValue = {
      high: 3,
      medium: 2,
      low: 1
    };
    
    return [...tasks].sort((a, b) => {
      const valueA = priorityValue[a.priority];
      const valueB = priorityValue[b.priority];
      return highFirst ? valueB - valueA : valueA - valueB;
    });
  }

  /**
   * Sort tasks by due date
   * @param tasks Tasks to sort
   * @param ascending Whether to sort in ascending order
   */
  private sortByDueDate(tasks: Task[], ascending: boolean = true): Task[] {
    return [...tasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      
      const dateA = new Date(a.due_date).getTime();
      const dateB = new Date(b.due_date).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }
}
