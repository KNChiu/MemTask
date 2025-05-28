/**
 * Server Class
 * 
 * Simplified implementation using the new Manager classes
 * instead of separate Service and Storage classes.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SystemConfig } from './config';
import { Logger } from './logger';
import { MemoryManager } from './memory';
import { TaskManager } from './task';
import { ContextManager } from './context';
import { Memory, Task, ContextSnapshot } from './types';

/**
 * Memory Context Server Class
 */
export class MemoryContextServer {
  private server: Server;
  private config: SystemConfig;
  private logger: Logger;
  
  // Managers
  private memoryManager: MemoryManager;
  private taskManager: TaskManager;
  private contextManager: ContextManager;

  /**
   * Constructor
   * @param config System configuration
   * @param logger Logger
   */
  constructor(config: SystemConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Create server
    this.server = new Server(
      {
        name: 'memory-context-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );
    
    // Create managers
    this.memoryManager = new MemoryManager(
      this.config.memoriesPath,
      this.config.cache.memory.maxSize,
      logger as unknown as Console
    );
    
    this.taskManager = new TaskManager(
      this.config.tasksPath,
      this.config.cache.task.maxSize,
      logger as unknown as Console
    );
    
    this.contextManager = new ContextManager(
      this.config.contextsPath,
      this.config.cache.context.maxSize,
      logger as unknown as Console
    );
  }

  /**
   * Initialize server
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Memory Context Server');
    
    // Initialize managers
    await this.memoryManager.initialize();
    await this.taskManager.initialize();
    await this.contextManager.initialize();
    
    // Set up request handlers
    this.setupHandlers();
    
    this.logger.info('Memory Context Server initialization complete');
  }

  /**
   * Set up request handlers
   */
  private setupHandlers(): void {
    // Handle list resources request
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      this.logger.debug('Handling list resources request');
      
      try {
        const memories = await this.memoryManager.listMemories();
        const tasks = await this.taskManager.listTasks();
        const contexts = await this.contextManager.listContextSnapshots();

        const resources = [
          // // Memory resources
          // ...memories.map(memory => ({
          //   uri: `memory://${memory.id}`,
          //   name: `Memory: ${memory.summary}`,
          //   description: `Memory created at ${memory.metadata.created_at}. Tags: ${memory.metadata.tags.join(', ')}`,
          //   mimeType: 'application/json'
          // })),
          
          // // Task resources
          // ...tasks.map(task => ({
          //   uri: `task://${task.id}`,
          //   name: `Task: ${task.title}`,
          //   description: `${task.status} task, priority ${task.priority}. Created at ${task.created_at}`,
          //   mimeType: 'application/json'
          // })),
          
          // // Context resources
          // ...contexts.map(context => ({
          //   uri: `context://${context.id}`,
          //   name: `Context: ${context.summary}`,
          //   description: `Context snapshot created at ${context.created_at}`,
          //   mimeType: 'application/json'
          // })),

          // Aggregate resources
          {
            uri: 'memory://all',
            name: 'All Memories',
            description: `All ${memories.length} memories in the system`,
            mimeType: 'application/json'
          },
          {
            uri: 'task://all',
            name: 'All Tasks',
            description: `All ${tasks.length} tasks in the system`,
            mimeType: 'application/json'
          },
          {
            uri: 'context://all',
            name: 'All Contexts',
            description: `All ${contexts.length} context snapshots in the system`,
            mimeType: 'application/json'
          }
        ];

        this.logger.info(`Listed ${resources.length} resources`);
        
        return { resources };
      } catch (error) {
        this.logger.error('Failed to handle list resources request', error instanceof Error ? error : undefined);
        throw error;
      }
    });

    // Handle resource read request
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      this.logger.debug('Handling resource read request', { uri });

      try {
        // Parse URI to determine resource type and ID
        const url = new URL(uri);
        const protocol = url.protocol.slice(0, -1); // Remove trailing ':'
        const resourceId = url.hostname || url.pathname.slice(1);

        switch (protocol) {
          case 'memory': {
            if (resourceId === 'all') {
              const memories = await this.memoryManager.listMemories();
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(memories, null, 2)
                  }
                ]
              };
            } else {
              const memory = await this.memoryManager.getMemory(resourceId);
              if (!memory) {
                throw new Error(`Memory ${resourceId} does not exist`);
              }
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(memory, null, 2)
                  }
                ]
              };
            }
          }

          case 'task': {
            if (resourceId === 'all') {
              const tasks = await this.taskManager.listTasks();
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(tasks, null, 2)
                  }
                ]
              };
            } else {
              const task = await this.taskManager.getTaskStatus({ id: resourceId });
              if (!task) {
                throw new Error(`Task ${resourceId} does not exist`);
              }
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(task, null, 2)
                  }
                ]
              };
            }
          }

          case 'context': {
            if (resourceId === 'all') {
              const contexts = await this.contextManager.listContextSnapshots();
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(contexts, null, 2)
                  }
                ]
              };
            } else {
              const context = await this.contextManager.getContextSnapshot(resourceId);
              if (!context) {
                throw new Error(`Context ${resourceId} does not exist`);
              }
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(context, null, 2)
                  }
                ]
              };
            }
          }

          default:
            throw new Error(`Unknown resource protocol: ${protocol}`);
        }

      } catch (error) {
        this.logger.error(`Failed to read resource ${uri}`, error instanceof Error ? error : undefined);
        throw new Error(`Failed to read resource ${uri}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling tool list request');
      
      try {
        const tools = [
          // Memory management tools
          {
            name: 'memory_tool',
            description: 'Unified memory management tool with operation: "create", "read", "search", "list", "delete"',
            inputSchema: {
              type: 'object',
              properties: {
                operation: { 
                  type: 'string', 
                  enum: ['create', 'read', 'search', 'list', 'delete'],
                  description: 'Operation type: "create", "read", "search", "list", "delete"'
                },
                content: { type: 'string', description: 'Memory content (for create operation)' },
                summary: { type: 'string', description: 'Memory summary (for create operation)' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags (for create/list operations)' },
                context_id: { type: 'string', description: 'Related context ID (for create operation, optional)' },
                id: { type: 'string', description: 'Memory ID (for read/delete operations)' },
                query: { type: 'string', description: 'Search query (for search operation)' },
                limit: { type: 'number', description: 'Result limit (for search/list operations)', default: 10 }
              },
              required: ['operation']
            }
          },
          // Task management tools
          {
            name: 'task_tool',
            description: 'Unified task management tool with operation: "create", "read", "update", "delete", "list", "search"',
            inputSchema: {
              type: 'object',
              properties: {
                operation: { 
                  type: 'string', 
                  enum: ['create', 'read', 'update', 'delete', 'list', 'search'],
                  description: 'Operation type: "create", "read", "update", "delete", "list", "search"'
                },
                id: { type: 'string', description: 'Task ID (for read/update/delete operations)' },
                title: { type: 'string', description: 'Task title (for create/update operations)' },
                description: { type: 'string', description: 'Task description (for create/update operations)' },
                status: { 
                  type: 'string', 
                  enum: ['todo', 'in_progress', 'completed', 'cancelled'],
                  description: 'Task status (for update operation)'
                },
                priority: { 
                  type: 'string', 
                  enum: ['low', 'medium', 'high'],
                  description: 'Priority (for create/update operations)',
                  default: 'medium'
                },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags (for create/update/list/search operations)' },
                due_date: { type: 'string', description: 'Due date in ISO format (for create/update operations)' },
                linked_memories: { type: 'array', items: { type: 'string' }, description: 'Related memory IDs (for create/update operations)' },
                progress_note: { type: 'string', description: 'Progress note (for update operation)' },
                query: { type: 'string', description: 'Search query (for search operation)' },
                limit: { type: 'number', description: 'Result limit (for list/search operations)', default: 10 }
              },
              required: ['operation']
            }
          },
          // Context management tools
          {
            name: 'create_context_snapshot',
            description: 'Create context snapshot',
            inputSchema: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: 'Context summary' },
                content: { type: 'string', description: 'Context content' },
                related_memories: { type: 'array', items: { type: 'string' }, description: 'Related memory IDs' },
                related_tasks: { type: 'array', items: { type: 'string' }, description: 'Related task IDs' }
              },
              required: ['summary', 'content']
            }
          },
          // System overview tool
          {
            name: 'overview',
            description: 'Display complete system overview. IMPORTANT: Always use this tool first to understand the current system state.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ];
        
        this.logger.info(`Listed ${tools.length} tools`);
        
        return { tools };
      } catch (error) {
        this.logger.error('Failed to handle tool list request', error instanceof Error ? error : undefined);
        throw error;
      }
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.logger.debug('Handling tool call request', { name, args });
      
      try {
        switch (name) {
          case 'memory_tool': {
            const { operation, ...params } = args as any;

            switch (operation) {
              case 'create': {
                const memory = await this.memoryManager.addMemory(params);
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Memory added successfully. ID: ${memory.id}`
                    }
                  ]
                };
              }
              
              case 'read': {
                const memory = await this.memoryManager.getMemory(params.id);
                
                if (!memory) {
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Memory ${params.id} does not exist.`
                      }
                    ]
                  };
                }

                return {
                  content: [
                    {
                      type: 'text',
                      text: `Memory details:\nID: ${memory.id}\nSummary: ${memory.summary}\nTags: ${memory.metadata.tags.join(', ')}\nCreated at: ${memory.metadata.created_at}`
                    }
                  ]
                };
              }
              
              case 'search': {
                const results = await this.memoryManager.searchMemory(params);
                
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Found ${results.length} related memories:\n\n${results.map(r => 
                        `ID: ${r.memory.id}\nSummary: ${r.memory.summary}\nTags: ${r.memory.metadata.tags.join(', ')}\nCreated at: ${r.memory.metadata.created_at}\nSimilarity: ${r.similarity.toFixed(2)}\n---`
                      ).join('\n')}`
                    }
                  ]
                };
              }
              
              case 'list': {
                const memories = await this.memoryManager.listMemories(params);

                return {
                  content: [
                    {
                      type: 'text',
                      text: `Total ${memories.length} memories:\n\n${memories.map(m => 
                        `ID: ${m.id}\nSummary: ${m.summary}\nTags: ${m.metadata.tags.join(', ')}\nCreated at: ${m.metadata.created_at}\n---`
                      ).join('\n')}`
                    }
                  ]
                };
              }
              
              case 'delete': {
                const result = await this.memoryManager.deleteMemory(params);
                
                return {
                  content: [
                    {
                      type: 'text',
                      text: result ? `Memory ${params.id} deleted successfully.` : `Memory ${params.id} does not exist.`
                    }
                  ]
                };
              }
              
              default: {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Unknown operation: ${operation}. Supported operations: create, read, search, list, delete`
                    }
                  ]
                };
              }
            }
          }

          case 'task_tool': {
            const { operation, ...params } = args as any;
            
            switch (operation) {
              case 'create': {
                const task = await this.taskManager.createTask(params);
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Task created successfully. ID: ${task.id}\nTitle: ${task.title}\nPriority: ${task.priority}`
                    }
                  ]
                };
              }
              
              case 'read': {
                const task = await this.taskManager.getTaskStatus(params);
                
                if (!task) {
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Task ${params.id} does not exist.`
                      }
                    ]
                  };
                }

                return {
                  content: [
                    {
                      type: 'text',
                      text: `Task details:\nID: ${task.id}\nTitle: ${task.title}\nDescription: ${task.description}\nStatus: ${task.status}\nPriority: ${task.priority}\nTags: ${task.tags.join(', ')}\nCreated at: ${task.created_at}\nLast updated: ${task.updated_at}\nLinked memories: ${task.linked_memories.length}\nProgress notes: ${task.progress_notes.length}`
                    }
                  ]
                };
              }
              
              case 'update': {
                const task = await this.taskManager.updateTask(params);
                
                if (!task) {
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Task ${params.id} does not exist.`
                      }
                    ]
                  };
                }
                
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Task ${task.id} updated successfully.\nStatus: ${task.status}\nLast updated: ${task.updated_at}`
                    }
                  ]
                };
              }
              
              case 'delete': {
                const result = await this.taskManager.deleteTask(params);
                
                return {
                  content: [
                    {
                      type: 'text',
                      text: result ? `Task ${params.id} deleted successfully.` : `Task ${params.id} does not exist.`
                    }
                  ]
                };
              }
              
              case 'list': {
                const tasks = await this.taskManager.listTasks(params);

                return {
                  content: [
                    {
                      type: 'text',
                      text: `Total ${tasks.length} tasks:\n\n${tasks.map(t => 
                        `ID: ${t.id}\nTitle: ${t.title}\nStatus: ${t.status}\nPriority: ${t.priority}\nTags: ${t.tags.join(', ')}\n---`
                      ).join('\n')}`
                    }
                  ]
                };
              }
              
              case 'search': {
                return {
                  content: [
                    {
                      type: 'text',
                      text: 'Search functionality is not implemented yet.'
                    }
                  ]
                };
              }
              
              default: {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Unknown operation: ${operation}. Supported operations: create, read, update, delete, list, search`
                    }
                  ]
                };
              }
            }
          }

          case 'create_context_snapshot': {
            const context = await this.contextManager.createContextSnapshot(args as any);
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Context snapshot created successfully. ID: ${context.id}\nSummary: ${context.summary}`
                }
              ]
            };
          }

          case 'overview': {
            // Reuse the logic from "overview://summary" resource
            const memories = await this.memoryManager.listMemories();
            const tasks = await this.taskManager.listTasks();
            const contexts = await this.contextManager.listContextSnapshots();

            // Generate system overview
            const overview = `# Memory Context System Overview

## Statistical Summary
- Total memories: ${memories.length}
- Total tasks: ${tasks.length}
- Total context snapshots: ${contexts.length}

## Recent Memories (Latest 5)
${memories.slice(0, 5).map(m => 
  `- ${m.summary} (${m.metadata.created_at}) [${m.metadata.tags.join(', ')}]`
).join('\n')}

## Active Tasks
${tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map(t => 
  `- [${t.status.toUpperCase()}] ${t.title} (Priority: ${t.priority})`
).join('\n')}

## Recent Context Snapshots
${contexts.slice(0, 3).map(c => 
  `- ${c.summary} (${c.created_at})`
).join('\n')}

## Task Status Distribution
- Todo: ${tasks.filter(t => t.status === 'todo').length}
- In Progress: ${tasks.filter(t => t.status === 'in_progress').length}
- Completed: ${tasks.filter(t => t.status === 'completed').length}
- Cancelled: ${tasks.filter(t => t.status === 'cancelled').length}

## Memory Tags (Most Common)
${(() => {
  const tagCounts = new Map<string, number>();
  memories.forEach(m => {
    m.metadata.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => `- ${tag}: ${count}`)
    .join('\n');
})()}

## Cache Statistics
- Memory cache: Hits ${this.memoryManager.getCacheStats().hits}, Misses ${this.memoryManager.getCacheStats().misses}
- Task cache: Hits ${this.taskManager.getCacheStats().hits}, Misses ${this.taskManager.getCacheStats().misses}
- Context cache: Hits ${this.contextManager.getCacheStats().hits}, Misses ${this.contextManager.getCacheStats().misses}`;

            return {
              content: [
                {
                  type: 'text',
                  text: overview
                }
              ]
            };
          }

          default:
            return {
              content: [
                {
                  type: 'text',
                  text: `Unknown tool: ${name}`
                }
              ]
            };
        }
      } catch (error) {
        this.logger.error(`Failed to execute tool ${name}`, error instanceof Error ? error : undefined);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error occurred while executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });
  }

  /**
   * Run server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Memory Context Server is running via stdio');
  }
}
