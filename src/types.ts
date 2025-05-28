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
    context_id?: string;
  };
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
  linked_memories: string[];
  progress_notes: string[];
}

/**
 * Context Snapshot Interface
 */
export interface ContextSnapshot {
  id: string;
  summary: string;
  content: string;
  created_at: string;
  related_memories: string[];
  related_tasks: string[];
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
  context_id?: string;
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
};

export type UpdateTaskArgs = {
  id: string;
  status?: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  progress_note?: string;
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

export type CreateContextSnapshotArgs = {
  summary: string;
  content: string;
  related_memories?: string[];
  related_tasks?: string[];
};
