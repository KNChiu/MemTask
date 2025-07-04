/**
 * Server Class
 * 
 * Updated to use unified CacheService instead of individual cache implementations.
 * Creates CacheService instances for each Manager to eliminate code duplication.
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
import { CacheServiceFactory } from './cache';
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
        version: '2.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );
    
    // Create cache service factory
    const cacheFactory = new CacheServiceFactory(logger);
    
    // Create cache services for each manager
    const memoryCacheService = cacheFactory.create<string, Memory>(this.config.cache.memory);
    const taskCacheService = cacheFactory.create<string, Task>(this.config.cache.task);
    const contextCacheService = cacheFactory.create<string, ContextSnapshot>(this.config.cache.context);
    
    // Create managers with injected cache services
    this.memoryManager = new MemoryManager(
      this.config.memoriesPath,
      memoryCacheService,
      logger as unknown as Console
    );
    
    this.taskManager = new TaskManager(
      this.config.tasksPath,
      taskCacheService,
      logger as unknown as Console
    );
    
    this.contextManager = new ContextManager(
      this.config.contextsPath,
      contextCacheService,
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
            name: 'create_memory',
            description: 'Create new memory entry',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Memory content' },
                summary: { type: 'string', description: 'Memory summary' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags (optional)' },
                context_id: { type: 'string', description: 'Related context ID (optional)' }
              },
              required: ['content', 'summary']
            }
          },
          {
            name: 'read_memory',
            description: 'Retrieve specific memory by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Memory ID' }
              },
              required: ['id']
            }
          },
          {
            name: 'search_memories',
            description: 'Search memories by query',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Result limit', default: 10 }
              },
              required: ['query']
            }
          },
          {
            name: 'list_memories',
            description: 'List memories with optional filtering',
            inputSchema: {
              type: 'object',
              properties: {
                tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (optional)' }
              }
            }
          },
          {
            name: 'delete_memory',
            description: 'Delete memory by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Memory ID' }
              },
              required: ['id']
            }
          },
          // Task management tools
          {
            name: 'create_task',
            description: 'Create new task',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Task description' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority (optional)', default: 'medium' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags (optional)' },
                due_date: { type: 'string', description: 'Due date in ISO format (optional)' },
                linked_memories: { type: 'array', items: { type: 'string' }, description: 'Related memory IDs (optional)' },
                depends_on: { type: 'array', items: { type: 'string' }, description: 'Task IDs this task depends on (optional)' }
              },
              required: ['title', 'description']
            }
          },
          {
            name: 'read_task',
            description: 'Retrieve specific task by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Task ID' }
              },
              required: ['id']
            }
          },
          {
            name: 'update_task',
            description: 'Update existing task',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Task ID' },
                status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'cancelled'], description: 'Task status (optional)' },
                title: { type: 'string', description: 'Task title (optional)' },
                description: { type: 'string', description: 'Task description (optional)' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority (optional)' },
                progress_note: { type: 'string', description: 'Progress note (optional)' },
                depends_on: { type: 'array', items: { type: 'string' }, description: 'Task IDs this task depends on (optional)' }
              },
              required: ['id']
            }
          },
          {
            name: 'search_tasks',
            description: 'Search tasks by query',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Result limit', default: 10 }
              },
              required: ['query']
            }
          },
          {
            name: 'list_tasks',
            description: 'List tasks with optional filtering',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'cancelled'], description: 'Filter by status (optional)' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter by priority (optional)' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (optional)' }
              }
            }
          },
          {
            name: 'delete_task',
            description: 'Delete task by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Task ID' }
              },
              required: ['id']
            }
          },
          // Context management tools
          {
            name: 'create_context_snapshot',
            description: 'Create context snapshot\n\nExample usage:\n' +
              JSON.stringify({
                "tool": "create_context_snapshot",
                "arguments": {
                  "summary": "Product development discussion context",
                  "content": "Detailed conversation content...",
                  "related_memories": ["memory-id-1"],
                  "related_tasks": ["task-id-1"]
                }
              }, null, 2),
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
          case 'create_memory': {
            const memory = await this.memoryManager.addMemory(args as any);
            return {
              content: [
                {
                  type: 'text',
                  text: `Memory added successfully. ID: ${memory.id}`
                }
              ]
            };
          }
          
          case 'read_memory': {
            const memory = await this.memoryManager.getMemory((args as any).id);
            
            if (!memory) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Memory ${(args as any).id} does not exist.`
                  }
                ]
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Memory details:\nID: ${memory.id}\nSummary: ${memory.summary}\nContent: ${memory.content}\nTags: ${memory.metadata.tags.join(', ')}\nCreated at: ${memory.metadata.created_at}\nUpdated at: ${memory.metadata.updated_at}`
                }
              ]
            };
          }
          
          case 'search_memories': {
            const results = await this.memoryManager.searchMemory(args as any);
            
            const truncateContent = (content: string, maxLength: number = 100) => {
              return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
            };
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${results.length} related memories:\n\n${results.map(r => 
                    `ID: ${r.memory.id}\nSummary: ${r.memory.summary}\nContent Preview: ${truncateContent(r.memory.content)}\nTags: ${r.memory.metadata.tags.join(', ')}\nCreated at: ${r.memory.metadata.created_at}\nSimilarity: ${r.similarity.toFixed(2)}\n---`
                  ).join('\n')}`
                }
              ]
            };
          }
          
          case 'list_memories': {
            const memories = await this.memoryManager.listMemories(args as any);

            const truncateContent = (content: string, maxLength: number = 100) => {
              return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
            };

            return {
              content: [
                {
                  type: 'text',
                  text: `Total ${memories.length} memories:\n\n${memories.map(m => 
                    `ID: ${m.id}\nSummary: ${m.summary}\nContent Preview: ${truncateContent(m.content)}\nTags: ${m.metadata.tags.join(', ')}\nCreated at: ${m.metadata.created_at}\n---`
                  ).join('\n')}`
                }
              ]
            };
          }
          
          case 'delete_memory': {
            const result = await this.memoryManager.deleteMemory(args as any);
            
            return {
              content: [
                {
                  type: 'text',
                  text: result ? `Memory ${(args as any).id} deleted successfully.` : `Memory ${(args as any).id} does not exist.`
                }
              ]
            };
          }

          case 'create_task': {
            const task = await this.taskManager.createTask(args as any);
            const executableTasks = await this.taskManager.getExecutableTasks();
            const isExecutable = executableTasks.some(t => t.id === task.id);
            const dependsText = task.depends_on && task.depends_on.length > 0 ? 
              `\nDependencies: ${task.depends_on.join(', ')}` : '';
            const statusText = isExecutable ? 
              '\nStatus: Ready to execute' : 
              (task.depends_on && task.depends_on.length > 0 ? 
                '\nStatus: Waiting for dependencies to complete' : 
                '\nStatus: Ready to execute');
            const nextAction = isExecutable ? 
              '\nNext: Use update_task to set status to "in_progress" when ready to start' :
              '\nNext: Complete dependent tasks first, then use overview to check executable tasks';
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Task ${task.id} created successfully.\nTitle: ${task.title}\nPriority: ${task.priority}${dependsText}${statusText}${nextAction}`
                }
              ]
            };
          }
          
          case 'read_task': {
            const task = await this.taskManager.getTaskStatus(args as any);
            
            if (!task) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Task ${(args as any).id} does not exist.`
                  }
                ]
              };
            }

            const linkedMemoriesText = task.linked_memories.length > 0 ? 
              `Linked memories:\n${task.linked_memories.map(id => `  - ${id}`).join('\n')}` : 
              'Linked memories: None';
            
            const progressNotesText = task.progress_notes.length > 0 ? 
              `Progress notes:\n${task.progress_notes.map((note, i) => `  ${i + 1}. ${note}`).join('\n')}` : 
              'Progress notes: None';

            return {
              content: [
                {
                  type: 'text',
                  text: `Task details:\nID: ${task.id}\nTitle: ${task.title}\nDescription: ${task.description}\nStatus: ${task.status}\nPriority: ${task.priority}\nTags: ${task.tags.join(', ')}\nCreated at: ${task.created_at}\nLast updated: ${task.updated_at}\nDue date: ${task.due_date || 'Not set'}\n${linkedMemoriesText}\n${progressNotesText}`
                }
              ]
            };
          }
          
          case 'update_task': {
            const task = await this.taskManager.updateTask(args as any);
            
            if (!task) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Task ${(args as any).id} does not exist.`
                  }
                ]
              };
            }
            
            // Check for unlocked tasks if this task was completed
            let unlockedTasksText = '';
            if (task.status === 'completed') {
              const allTasks = await this.taskManager.getTasksInOrder();
              const unlockedTasks = allTasks.filter(t => 
                t.depends_on && t.depends_on.includes(task.id) && 
                t.status !== 'completed' && t.status !== 'cancelled'
              );
              if (unlockedTasks.length > 0) {
                unlockedTasksText = `\nUnlocked tasks: ${unlockedTasks.map(t => `Task ${t.id}`).join(', ')}`;
              }
            }
            
            // Get next action suggestion
            const executableTasks = await this.taskManager.getExecutableTasks();
            const nextActionText = executableTasks.length > 0 ? 
              `\nNext: ${executableTasks.length} task(s) ready to execute. Use overview to see them.` :
              '\nNext: Use overview to check system status and plan next steps.';
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Task ${task.id} updated successfully.\nStatus: ${task.status}\nLast updated: ${task.updated_at}${unlockedTasksText}${nextActionText}`
                }
              ]
            };
          }
          
          case 'delete_task': {
            const result = await this.taskManager.deleteTask(args as any);
            
            return {
              content: [
                {
                  type: 'text',
                  text: result ? `Task ${(args as any).id} deleted successfully.` : `Task ${(args as any).id} does not exist.`
                }
              ]
            };
          }
          
          case 'list_tasks': {
            const tasks = await this.taskManager.listTasks(args as any);
            const executableTasks = await this.taskManager.getExecutableTasks();

            const truncateDescription = (description: string, maxLength: number = 100) => {
              return description.length > maxLength ? description.substring(0, maxLength) + '...' : description;
            };

            // Sort tasks by numeric ID for better order display
            const sortedTasks = tasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));
            
            const taskList = sortedTasks.map(t => {
              const isExecutable = executableTasks.some(et => et.id === t.id);
              const statusIcon = t.status === 'completed' ? 'DONE' : 
                                t.status === 'in_progress' ? 'ACTIVE' : 
                                t.status === 'cancelled' ? 'CANCELLED' :
                                isExecutable ? 'READY' : 'WAITING';
              const dependsText = t.depends_on && t.depends_on.length > 0 ? 
                `\nDepends on: ${t.depends_on.join(', ')}` : '';
              
              return `Task ${t.id}: ${t.title}\nStatus: ${statusIcon} | Priority: ${t.priority}\nDescription: ${truncateDescription(t.description)}${dependsText}\n---`;
            }).join('\n');

            const executableCount = executableTasks.filter(t => tasks.some(lt => lt.id === t.id)).length;
            const suggestion = executableCount > 0 ? 
              `\n${executableCount} task(s) ready to execute. Consider starting with update_task.` :
              '\nUse overview to see all tasks with dependency information.';

            return {
              content: [
                {
                  type: 'text',
                  text: `Total ${tasks.length} tasks:\n\n${taskList}${suggestion}`
                }
              ]
            };
          }
          
          case 'search_tasks': {
            const tasks = await this.taskManager.searchTask(args as any);
            
            const truncateDescription = (description: string, maxLength: number = 100) => {
              return description.length > maxLength ? description.substring(0, maxLength) + '...' : description;
            };
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${tasks.length} related tasks:\n\n${tasks.map(t => 
                    `ID: ${t.task.id}\nTitle: ${t.task.title}\nDescription Preview: ${truncateDescription(t.task.description)}\nStatus: ${t.task.status}\nPriority: ${t.task.priority}\nTags: ${t.task.tags.join(', ')}\nSimilarity: ${t.similarity.toFixed(2)}\n---`
                  ).join('\n')}`
                }
              ]
            };
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
        
            const truncateText = (text: string, maxLength: number = 80) => {
                return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
            };
        
            // Calculate statistics
            const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
            const executableTasks = await this.taskManager.getExecutableTasks();
            const tasksInOrder = await this.taskManager.getTasksInOrder();
            
            const taskStats = {
                todo: tasks.filter(t => t.status === 'todo').length,
                inProgress: tasks.filter(t => t.status === 'in_progress').length,
                completed: tasks.filter(t => t.status === 'completed').length,
                cancelled: tasks.filter(t => t.status === 'cancelled').length
            };
        
            // Calculate label statistics
            const tagCounts = new Map<string, number>();
            memories.forEach(m => {
                m.metadata.tags.forEach(tag => {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                });
            });
            const topTags = Array.from(tagCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
        
            // Cache Statistics
            const memoryCache = this.memoryManager.getCacheStats();
            const taskCache = this.taskManager.getCacheStats();
            const contextCache = this.contextManager.getCacheStats();
            const totalHits = memoryCache.hits + taskCache.hits + contextCache.hits;
            const totalMisses = memoryCache.misses + taskCache.misses + contextCache.misses;
            const overallHitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses) * 100).toFixed(1) : '0.0';
        
            // Generate system overview
            const overview = `# Memory Context System Overview

## Recent Memories

${memories.length === 0 ? '*No memories found*' : 
    memories.slice(0, 5).map((m, i) => 
        `### ${i + 1}. ${truncateText(m.summary)}
**Tags:** ${m.metadata.tags.join(', ') || 'None'}  
**Created:** ${m.metadata.created_at}  
**ID:** \`${m.id}\`
`
    ).join('\n')}

## Tasks (In Sequential Order)

${tasksInOrder.length === 0 ? '*No tasks found*' : 
    tasksInOrder.slice(0, 10).map((t) => {
        const isExecutable = executableTasks.some(et => et.id === t.id);
        const dependsText = t.depends_on && t.depends_on.length > 0 ? ` (depends on: ${t.depends_on.join(', ')})` : '';
        const statusIcon = t.status === 'completed' ? 'DONE' : 
                          t.status === 'in_progress' ? 'ACTIVE' : 
                          t.status === 'cancelled' ? 'CANCELLED' :
                          isExecutable ? 'READY' : 'WAITING';
        
        return `### Task ${t.id}: ${truncateText(t.title)}
**Status:** ${statusIcon} | **Priority:** ${t.priority.toUpperCase()}${dependsText}`;
    }).join('\n\n')}

## Recent Context Snapshots

${contexts.length === 0 ? '*No context snapshots found*' :
    contexts.slice(0, 3).map((c, i) => 
        `### ${i + 1}. ${truncateText(c.summary)}
**Created:** ${c.created_at}
`
    ).join('\n')}

## Task Status Distribution

| Status | Count |
|--------|-------|
| Todo | ${taskStats.todo} |
| In Progress | ${taskStats.inProgress} |
| Completed | ${taskStats.completed} |
| Cancelled | ${taskStats.cancelled} |
| **Total** | **${tasks.length}** |

## System Health Summary

**Memory System:** ${memories.length > 0 ? 'Active' : 'Empty'}  
**Task Management:** ${tasks.length > 0 ? `${activeTasks.length} active out of ${tasks.length} total` : 'No tasks'}  
**Context Tracking:** ${contexts.length > 0 ? 'Active' : 'No snapshots'}  
**Cache Efficiency:** ${parseFloat(overallHitRate) > 80 ? 'Excellent' : parseFloat(overallHitRate) > 60 ? 'Good' : parseFloat(overallHitRate) > 40 ? 'Fair' : 'Poor'}

## Next Actions Recommended

${tasks.length === 0 ? 
    '**Suggestion:** Create your first task using task_tool with operation "create"' :
    executableTasks.length === 0 ? 
        (activeTasks.length === 0 ? 
            '**All tasks completed!** Consider creating new tasks or reviewing completed work.' :
            '**No executable tasks found.** Check task dependencies or update task status.') :
        `**Ready to execute:** ${executableTasks.length} task(s) available\n${executableTasks.slice(0, 3).map(t => 
            `- Task ${t.id}: ${truncateText(t.title, 50)}`
        ).join('\n')}\n\n**Suggestion:** Use task_tool with operation "update" to start working on these tasks.`
}

---
*Report generated at: ${new Date()}*
`;

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
