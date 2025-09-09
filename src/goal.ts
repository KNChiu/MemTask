/**
 * Goal Management Module
 * 
 * Provides comprehensive goal management functionality including CRUD operations,
 * progress tracking, and task linkage management.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import * as crypto from 'crypto';
import { Goal, CreateGoalArgs, UpdateGoalArgs, GetGoalArgs, ListGoalsArgs, DeleteGoalArgs, SearchGoalArgs } from './types';
import { CacheService } from './cache';

/**
 * Goal Manager Class
 * 
 * Manages goal lifecycle with task linkage, progress tracking, and success criteria.
 * Follows the same patterns as TaskManager for consistency.
 */
export class GoalManager {
  private storagePath: string;
  private cache: CacheService<string, Goal>;
  private console: Console;

  /**
   * Constructor
   * @param storagePath Storage path
   * @param cacheService Unified cache service instance
   * @param console Console for logging (optional)
   */
  constructor(
    storagePath: string, 
    cacheService: CacheService<string, Goal>,
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
      const errorMessage = `Failed to initialize goal storage: ${error instanceof Error ? error.message : String(error)}`;
      this.console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Get next sequential goal ID
   */
  private async getNextGoalId(): Promise<string> {
    try {
      const goals = await this.list();
      if (goals.length === 0) {
        return 'goal-1';
      }
      
      // Find the highest numeric ID
      const maxId = Math.max(
        ...goals
          .map(goal => {
            const match = goal.id.match(/goal-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(id => !isNaN(id))
      );
      
      return `goal-${maxId + 1}`;
    } catch (error) {
      this.console.error('Failed to generate next goal ID:', error);
      return 'goal-1';
    }
  }

  /**
   * Create goal
   * @param args Create goal parameters
   */
  async createGoal(args: CreateGoalArgs): Promise<Goal> {
    try {
      // Basic validation
      if (!args.title) throw new Error('Title is required');
      if (!args.description) throw new Error('Description is required');
      
      // Sanitize parameters
      const title = args.title.substring(0, 100).replace(/[<>]/g, '');
      const description = args.description.substring(0, 2000).replace(/[<>]/g, '');
      const tags = Array.isArray(args.tags) ? args.tags.map(tag => String(tag).substring(0, 50).replace(/[<>]/g, '')) : [];
      
      // Validate priority
      let priority: 'low' | 'medium' | 'high' = 'medium';
      if (args.priority) {
        if (!['low', 'medium', 'high'].includes(args.priority)) {
          throw new Error('Priority must be one of: low, medium, or high');
        }
        priority = args.priority as 'low' | 'medium' | 'high';
      }
      
      // Validate target date
      let target_date: string | undefined = undefined;
      if (args.target_date) {
        try {
          const date = new Date(args.target_date);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
          target_date = date.toISOString();
        } catch (error) {
          throw new Error('Target date must be a valid date format');
        }
      }
      
      // Validate success criteria
      let success_criteria: string[] = [];
      if (args.success_criteria && Array.isArray(args.success_criteria)) {
        success_criteria = args.success_criteria.map(criteria => 
          String(criteria).substring(0, 200).replace(/[<>]/g, '')
        );
      }
      
      // Validate linked tasks
      let linked_tasks: string[] = [];
      if (args.linked_tasks && Array.isArray(args.linked_tasks)) {
        linked_tasks = args.linked_tasks.map(id => String(id));
        await this.validateLinkedTasks(linked_tasks);
      }
      
      const goalId = await this.getNextGoalId();
      const goal: Goal = {
        id: goalId,
        title,
        description,
        status: 'planning',
        priority,
        tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        target_date,
        progress_notes: [],
        linked_tasks,
        success_criteria
      };
      
      await this.save(goal.id, goal);
      return goal;
    } catch (error) {
      this.console.error('Failed to create goal:', error);
      throw error;
    }
  }

  /**
   * Update goal
   * @param args Update goal parameters
   */
  async updateGoal(args: UpdateGoalArgs): Promise<Goal | null> {
    try {
      if (!args) throw new Error('Arguments are required');
      if (!args.id) throw new Error('ID is required');
      
      const goal = await this.load(args.id);
      if (!goal) return null;
      
      // Update goal properties
      if (args.status) {
        if (!['planning', 'active', 'completed', 'on_hold', 'cancelled'].includes(args.status)) {
          throw new Error('Status must be one of: planning, active, completed, on_hold, or cancelled');
        }
        goal.status = args.status;
      }
      
      if (args.title) {
        goal.title = args.title.substring(0, 100).replace(/[<>]/g, '');
      }
      
      if (args.description) {
        goal.description = args.description.substring(0, 2000).replace(/[<>]/g, '');
      }
      
      if (args.priority) {
        if (!['low', 'medium', 'high'].includes(args.priority)) {
          throw new Error('Priority must be one of: low, medium, or high');
        }
        goal.priority = args.priority as 'low' | 'medium' | 'high';
      }
      
      if (args.target_date) {
        try {
          const date = new Date(args.target_date);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
          goal.target_date = date.toISOString();
        } catch (error) {
          throw new Error('Target date must be a valid date format');
        }
      }
      
      if (args.progress_note) {
        const note = args.progress_note.substring(0, 1000).replace(/[<>]/g, '');
        goal.progress_notes.push(`${new Date().toISOString()}: ${note}`);
      }
      
      if (args.success_criteria !== undefined) {
        if (Array.isArray(args.success_criteria)) {
          goal.success_criteria = args.success_criteria.map(criteria => 
            String(criteria).substring(0, 200).replace(/[<>]/g, '')
          );
        }
      }
      
      if (args.linked_tasks !== undefined) {
        if (Array.isArray(args.linked_tasks)) {
          const linked_tasks = args.linked_tasks.map(id => String(id));
          await this.validateLinkedTasks(linked_tasks);
          goal.linked_tasks = linked_tasks;
        }
      }
      
      goal.updated_at = new Date().toISOString();
      
      await this.save(goal.id, goal);
      return goal;
    } catch (error) {
      this.console.error('Failed to update goal:', error);
      throw error;
    }
  }

  /**
   * Get goal
   * @param args Get goal parameters
   */
  async getGoal(args: GetGoalArgs): Promise<Goal | null> {
    try {
      if (!args.id) throw new Error('ID is required');
      return this.load(args.id);
    } catch (error) {
      this.console.error('Failed to get goal:', error);
      throw error;
    }
  }

  /**
   * List goals
   * @param args List goals parameters
   */
  async listGoals(args?: ListGoalsArgs): Promise<Goal[]> {
    try {
      let goals = await this.list();
      
      // Apply filters
      if (args?.status) {
        if (!['planning', 'active', 'completed', 'on_hold', 'cancelled'].includes(args.status)) {
          throw new Error('Status must be one of: planning, active, completed, on_hold, or cancelled');
        }
        goals = goals.filter(goal => goal.status === args.status);
      }
      
      if (args?.priority) {
        if (!['low', 'medium', 'high'].includes(args.priority)) {
          throw new Error('Priority must be one of: low, medium, or high');
        }
        goals = goals.filter(goal => goal.priority === args.priority);
      }
      
      if (args?.tags && args.tags.length > 0) {
        goals = goals.filter(goal => 
          args.tags!.some(tag => goal.tags.includes(tag))
        );
      }
      
      // Sort by update time (newest first)
      goals.sort((a, b) => {
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        return dateB - dateA;
      });
      
      return goals;
    } catch (error) {
      this.console.error('Failed to list goals:', error);
      throw error;
    }
  }

  /**
   * Delete goal
   * @param args Delete goal parameters
   */
  async deleteGoal(args: DeleteGoalArgs): Promise<boolean> {
    try {
      if (!args.id) throw new Error('ID is required');
      return this.delete(args.id);
    } catch (error) {
      this.console.error('Failed to delete goal:', error);
      throw error;
    }
  }

  /**
   * Search goals
   * @param args Search parameters
   */
  async searchGoal(args: SearchGoalArgs): Promise<Array<{ goal: Goal, similarity: number }>> {
    try {
      if (!args.query) throw new Error('Query is required');
      
      const query = args.query.toLowerCase();
      const limit = args.limit || 10;
      const goals = await this.list();
      
      const results = goals
        .map(goal => {
          const titleMatch = goal.title.toLowerCase().includes(query);
          const descMatch = goal.description.toLowerCase().includes(query);
          const tagMatch = goal.tags.some(tag => tag.toLowerCase().includes(query));
          const notesMatch = goal.progress_notes.some(note => note.toLowerCase().includes(query));
          const criteriaMatch = goal.success_criteria.some(criteria => criteria.toLowerCase().includes(query));
          
          if (titleMatch || descMatch || tagMatch || notesMatch || criteriaMatch) {
            return {
              goal,
              similarity: 0.9
            };
          }
          
          return {
            goal,
            similarity: this.calculateSimpleSimilarity(query, 
              `${goal.title} ${goal.description} ${goal.tags.join(' ')} ${goal.progress_notes.join(' ')} ${goal.success_criteria.join(' ')}`)
          };
        })
        .filter(result => result.similarity > 0.01)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      return results;
    } catch (error) {
      this.console.error('Failed to search goals:', error);
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
   * @param id Goal ID
   * @param note Progress note
   */
  async addProgressNote(id: string, note: string): Promise<boolean> {
    try {
      if (!id) throw new Error('ID is required');
      if (!note) throw new Error('Note is required');
      
      const goal = await this.load(id);
      if (!goal) return false;
      
      const sanitizedNote = note.substring(0, 1000).replace(/[<>]/g, '');
      goal.progress_notes.push(`${new Date().toISOString()}: ${sanitizedNote}`);
      goal.updated_at = new Date().toISOString();
      
      await this.save(id, goal);
      return true;
    } catch (error) {
      this.console.error('Failed to add progress note:', error);
      throw error;
    }
  }

  /**
   * Update goal status
   * @param id Goal ID
   * @param status New status
   */
  async updateStatus(id: string, status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'): Promise<boolean> {
    try {
      if (!id) throw new Error('ID is required');
      
      if (!['planning', 'active', 'completed', 'on_hold', 'cancelled'].includes(status)) {
        throw new Error('Status must be one of: planning, active, completed, on_hold, or cancelled');
      }
      
      const goal = await this.load(id);
      if (!goal) return false;
      
      goal.status = status;
      goal.updated_at = new Date().toISOString();
      
      await this.save(id, goal);
      return true;
    } catch (error) {
      this.console.error('Failed to update goal status:', error);
      throw error;
    }
  }

  /**
   * Get overdue goals
   */
  async getOverdueGoals(): Promise<Goal[]> {
    try {
      const goals = await this.list();
      const now = new Date().getTime();
      
      return goals.filter(goal => {
        if (!goal.target_date) return false;
        if (goal.status === 'completed' || goal.status === 'cancelled') return false;
        
        const targetDate = new Date(goal.target_date).getTime();
        return targetDate < now;
      });
    } catch (error) {
      this.console.error('Failed to get overdue goals:', error);
      throw error;
    }
  }

  /**
   * Get goals by linked task
   * @param taskId Task ID
   */
  async getGoalsByLinkedTask(taskId: string): Promise<Goal[]> {
    try {
      if (!taskId) throw new Error('Task ID is required');
      
      const goals = await this.list();
      return goals.filter(goal => goal.linked_tasks.includes(taskId));
    } catch (error) {
      this.console.error('Failed to get goals by linked task:', error);
      throw error;
    }
  }

  /**
   * Batch get goals
   * @param ids Array of goal IDs
   */
  async batchGetGoals(ids: string[]): Promise<Goal[]> {
    try {
      if (!Array.isArray(ids)) throw new Error('IDs must be an array');
      
      const goals: Goal[] = [];
      for (const id of ids) {
        const goal = await this.load(id);
        if (goal) goals.push(goal);
      }
      
      return goals;
    } catch (error) {
      this.console.error('Failed to batch get goals:', error);
      throw error;
    }
  }

  /**
   * Validate linked tasks
   * @param linkedTasks Array of task IDs
   */
  private async validateLinkedTasks(linkedTasks: string[]): Promise<void> {
    // Note: In a real implementation, we would check if tasks exist
    // For now, we'll assume task validation will be handled by the task manager
    if (!linkedTasks || linkedTasks.length === 0) {
      return;
    }
    
    // Basic validation - just check that they are strings
    for (const taskId of linkedTasks) {
      if (typeof taskId !== 'string' || !taskId.trim()) {
        throw new Error(`Invalid task ID: ${taskId}`);
      }
    }
  }

  /**
   * Get goals ordered by ID
   */
  async getGoalsInOrder(): Promise<Goal[]> {
    try {
      const goals = await this.list();
      return goals.sort((a, b) => {
        const idA = parseInt(a.id.replace('goal-', ''));
        const idB = parseInt(b.id.replace('goal-', ''));
        return idA - idB;
      });
    } catch (error) {
      this.console.error('Failed to get goals in order:', error);
      return [];
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
   * Save goal
   * @param id Goal ID
   * @param goal Goal object
   */
  private async save(id: string, goal: Goal): Promise<void> {
    const filePath = path.join(this.storagePath, `${id}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(goal, null, 2));
      this.cache.set(id, goal);
    } catch (error) {
      throw new Error(`Failed to save goal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load goal
   * @param id Goal ID
   */
  private async load(id: string): Promise<Goal | null> {
    // Check cache
    const cachedGoal = this.cache.get(id);
    if (cachedGoal) {
      return cachedGoal;
    }
    
    try {
      const filePath = path.join(this.storagePath, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const goal = JSON.parse(content) as Goal;
      
      // Update cache
      this.cache.set(id, goal);
      return goal;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      
      this.console.error(`Failed to load goal ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete goal
   * @param id Goal ID
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
      
      this.console.error(`Failed to delete goal ${id}:`, error);
      return false;
    }
  }

  /**
   * List all goals
   */
  private async list(): Promise<Goal[]> {
    try {
      const files = await fs.readdir(this.storagePath);
      const goals: Goal[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const goal = await this.load(id);
          if (goal) goals.push(goal);
        }
      }
      
      return goals;
    } catch (error) {
      this.console.error('Failed to list goals:', error);
      return [];
    }
  }

  /**
   * Sort goals by priority
   * @param goals Goals to sort
   * @param highFirst Whether high priority comes first
   */
  private sortByPriority(goals: Goal[], highFirst: boolean = true): Goal[] {
    const priorityValue = {
      high: 3,
      medium: 2,
      low: 1
    };
    
    return [...goals].sort((a, b) => {
      const valueA = priorityValue[a.priority];
      const valueB = priorityValue[b.priority];
      return highFirst ? valueB - valueA : valueA - valueB;
    });
  }

  /**
   * Sort goals by target date
   * @param goals Goals to sort
   * @param ascending Whether to sort in ascending order
   */
  private sortByTargetDate(goals: Goal[], ascending: boolean = true): Goal[] {
    return [...goals].sort((a, b) => {
      if (!a.target_date && !b.target_date) return 0;
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      
      const dateA = new Date(a.target_date).getTime();
      const dateB = new Date(b.target_date).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }
}