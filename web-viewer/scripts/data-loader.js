/**
 * Data Loader Module
 *
 * Handles data fetching from the backend API with:
 * - Auto-polling with exponential backoff
 * - Error handling and retry logic
 * - Data caching and change detection
 * - Event-driven updates
 */

import { logger } from './logger.js';
import { deepEqual } from './utils.js';

// Configuration
const API_BASE_URL = '/api';
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_INTERVAL = 60000; // 60 seconds
const BACKOFF_MULTIPLIER = 1.5;

/**
 * DataLoader class - Manages data fetching and polling
 */
export class DataLoader {
  constructor() {
    this.data = {
      goals: [],
      tasks: [],
      memories: []
    };

    this.pollInterval = POLL_INTERVAL;
    this.pollTimer = null;
    this.isPolling = false;
    this.listeners = new Map();
    this.lastFetchTime = null;
    this.consecutiveErrors = 0;
  }

  /**
   * Initialize data loader and start polling
   */
  async init() {
    logger.info('DataLoader', 'Initializing data loader');

    try {
      await this.loadAll();
      this.startPolling();
      return true;
    } catch (error) {
      logger.error('DataLoader', 'Failed to initialize', error);
      throw error;
    }
  }

  /**
   * Load all data from API
   */
  async loadAll() {
    logger.info('DataLoader', 'Loading all data');

    try {
      const [goals, tasks, memories] = await Promise.all([
        this.fetchGoals(),
        this.fetchTasks(),
        this.fetchMemories()
      ]);

      const hasChanges = this.updateData({ goals, tasks, memories });

      this.lastFetchTime = Date.now();
      this.consecutiveErrors = 0;
      this.pollInterval = POLL_INTERVAL; // Reset poll interval on success

      if (hasChanges) {
        this.emit('data:updated', this.data);
      }

      return this.data;
    } catch (error) {
      this.consecutiveErrors++;
      logger.error('DataLoader', `Failed to load data (attempt ${this.consecutiveErrors})`, error);
      throw error;
    }
  }

  /**
   * Fetch goals from API
   */
  async fetchGoals() {
    try {
      const response = await fetch(`${API_BASE_URL}/goals`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const goals = await response.json();
      logger.debug('DataLoader', `Fetched ${goals.length} goals`);
      return goals;
    } catch (error) {
      logger.error('DataLoader', 'Failed to fetch goals', error);
      throw error;
    }
  }

  /**
   * Fetch tasks from API
   */
  async fetchTasks() {
    try {
      const response = await fetch(`${API_BASE_URL}/tasks`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const tasks = await response.json();
      logger.debug('DataLoader', `Fetched ${tasks.length} tasks`);
      return tasks;
    } catch (error) {
      logger.error('DataLoader', 'Failed to fetch tasks', error);
      throw error;
    }
  }

  /**
   * Fetch memories from API
   */
  async fetchMemories() {
    try {
      const response = await fetch(`${API_BASE_URL}/memories`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const memories = await response.json();
      logger.debug('DataLoader', `Fetched ${memories.length} memories`);
      return memories;
    } catch (error) {
      logger.error('DataLoader', 'Failed to fetch memories', error);
      throw error;
    }
  }

  /**
   * Update internal data cache and detect changes
   * @returns {boolean} True if data changed
   */
  updateData(newData) {
    let hasChanges = false;

    for (const [key, value] of Object.entries(newData)) {
      if (!deepEqual(this.data[key], value)) {
        this.data[key] = value;
        hasChanges = true;
        this.emit(`${key}:updated`, value);
      }
    }

    return hasChanges;
  }

  /**
   * Start auto-polling
   */
  startPolling() {
    if (this.isPolling) {
      logger.warn('DataLoader', 'Polling already started');
      return;
    }

    logger.info('DataLoader', `Starting auto-poll (interval: ${this.pollInterval}ms)`);
    this.isPolling = true;
    this.scheduleNextPoll();
  }

  /**
   * Stop auto-polling
   */
  stopPolling() {
    if (!this.isPolling) {
      return;
    }

    logger.info('DataLoader', 'Stopping auto-poll');
    this.isPolling = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Schedule next poll with exponential backoff on errors
   */
  scheduleNextPoll() {
    if (!this.isPolling) {
      return;
    }

    // Apply exponential backoff on consecutive errors
    let interval = this.pollInterval;
    if (this.consecutiveErrors > 0) {
      interval = Math.min(
        this.pollInterval * Math.pow(BACKOFF_MULTIPLIER, this.consecutiveErrors),
        MAX_POLL_INTERVAL
      );
    }

    this.pollTimer = setTimeout(async () => {
      try {
        await this.loadAll();
      } catch (error) {
        // Error already logged in loadAll
        this.emit('data:error', error);
      }

      this.scheduleNextPoll();
    }, interval);
  }

  /**
   * Force refresh data immediately
   */
  async refresh() {
    logger.info('DataLoader', 'Force refresh triggered');

    try {
      await this.loadAll();
      this.emit('data:refreshed', this.data);
      return this.data;
    } catch (error) {
      this.emit('data:error', error);
      throw error;
    }
  }

  /**
   * Get current data snapshot
   */
  getData() {
    return this.data;
  }

  /**
   * Get goals data
   */
  getGoals() {
    return this.data.goals;
  }

  /**
   * Get tasks data
   */
  getTasks() {
    return this.data.tasks;
  }

  /**
   * Get memories data
   */
  getMemories() {
    return this.data.memories;
  }

  /**
   * Get goal by ID
   */
  getGoalById(id) {
    return this.data.goals.find(g => g.id === id);
  }

  /**
   * Get task by ID
   */
  getTaskById(id) {
    return this.data.tasks.find(t => t.id === id);
  }

  /**
   * Get memory by ID
   */
  getMemoryById(id) {
    return this.data.memories.find(m => m.id === id);
  }

  /**
   * Get tasks for a specific goal
   */
  getTasksByGoalId(goalId) {
    return this.data.tasks.filter(t => t.goal_id === goalId);
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unregister event listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return;
    }

    const listeners = this.listeners.get(event);
    const index = listeners.indexOf(callback);

    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }

    const listeners = this.listeners.get(event);

    for (const callback of listeners) {
      try {
        callback(data);
      } catch (error) {
        logger.error('DataLoader', `Error in event listener for ${event}`, error);
      }
    }
  }

  /**
   * Get last fetch timestamp
   */
  getLastFetchTime() {
    return this.lastFetchTime;
  }

  /**
   * Destroy data loader and cleanup
   */
  destroy() {
    logger.info('DataLoader', 'Destroying data loader');

    this.stopPolling();
    this.listeners.clear();
    this.data = { goals: [], tasks: [], memories: [] };
    this.lastFetchTime = null;
  }
}

// Export singleton instance
export const dataLoader = new DataLoader();
