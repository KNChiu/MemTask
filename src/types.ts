/**
 * Define all types
 */

/**
 * Memory Item Interface
 */
export interface Memory {
  id: string;
  content: string;
  summary: string;
  embedding?: number[];
  metadata: {
    created_at: string;
    updated_at: string;
    tags: string[];
  };
}

/**
 * Goal Item Interface
 */
export interface Goal {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  created_at: string;
  updated_at: string;
  target_date?: string;
  progress_notes: string[];
  linked_tasks: string[];
  success_criteria: string[];
}

/**
 * Task Item Interface
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  created_at: string;
  updated_at: string;
  due_date?: string;
  goal_id?: string;
  linked_memories: string[];
  progress_notes: string[];
  depends_on: string[];
}


/**
 * Cache Statistics Interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
}

/**
 * Cache Configuration Interface
 */
export interface CacheConfig {
  maxSize: number;
  ttlMs: number;
}

/**
 * Tool Parameter Types
 */
export type AddMemoryArgs = {
  content: string;
  summary: string;
  tags?: string[];
};

export type SearchMemoryArgs = {
  query: string;
  limit?: number;
};

export type ListMemoriesArgs = {
  tags?: string[];
};

export type DeleteMemoryArgs = {
  id: string;
};

export type CreateTaskArgs = {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  due_date?: string;
  linked_memories?: string[];
  depends_on?: string[];
};

export type UpdateTaskArgs = {
  id: string;
  status?: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  progress_note?: string;
  depends_on?: string[];
};

export type GetTaskStatusArgs = {
  id: string;
};

export type ListTasksArgs = {
  status?: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
};

export type DeleteTaskArgs = {
  id: string;
};

export type SearchTaskArgs = {
  query: string;
  limit?: number;
};

/**
 * Goal Tool Parameter Types
 */
export type CreateGoalArgs = {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  target_date?: string;
  success_criteria?: string[];
  linked_tasks?: string[];
};

export type UpdateGoalArgs = {
  id: string;
  status?: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  target_date?: string;
  progress_note?: string;
  success_criteria?: string[];
  linked_tasks?: string[];
};

export type GetGoalArgs = {
  id: string;
};

export type ListGoalsArgs = {
  status?: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
};

export type DeleteGoalArgs = {
  id: string;
};

export type SearchGoalArgs = {
  query: string;
  limit?: number;
};

