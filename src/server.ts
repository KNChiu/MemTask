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
import { GoalManager } from './goal';
import { CacheServiceFactory } from './cache';
import { 
  Memory, 
  Task, 
  Goal,
  AddMemoryArgs,
  SearchMemoryArgs,
  ListMemoriesArgs,
  DeleteMemoryArgs,
  CreateTaskArgs,
  UpdateTaskArgs,
  GetTaskStatusArgs,
  ListTasksArgs,
  DeleteTaskArgs,
  SearchTaskArgs,
  CreateGoalArgs,
  UpdateGoalArgs,
  GetGoalArgs,
  ListGoalsArgs,
  DeleteGoalArgs,
  SearchGoalArgs
} from './types';

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
  private goalManager: GoalManager;

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
    const goalCacheService = cacheFactory.create<string, Goal>(this.config.cache.goal);
    
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
    
    this.goalManager = new GoalManager(
      this.config.goalsPath,
      goalCacheService,
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
    await this.goalManager.initialize();
    
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
        const goals = await this.goalManager.listGoals();

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
          
          // // Goal resources
          // ...goals.map(goal => ({
          //   uri: `goal://${goal.id}`,
          //   name: `Goal: ${goal.title}`,
          //   description: `${goal.status} goal, priority ${goal.priority}. Created at ${goal.created_at}`,
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
            uri: 'goal://all',
            name: 'All Goals',
            description: `All ${goals.length} goals in the system`,
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

          case 'goal': {
            if (resourceId === 'all') {
              const goals = await this.goalManager.listGoals();
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(goals, null, 2)
                  }
                ]
              };
            } else {
              const goal = await this.goalManager.getGoal({ id: resourceId });
              if (!goal) {
                throw new Error(`Goal ${resourceId} does not exist`);
              }
              return {
                contents: [
                  {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(goal, null, 2)
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
          // Goal management tools
          {
            name: 'create_goal',
            description: 'Create new goal',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Goal title' },
                description: { type: 'string', description: 'Goal description' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority (optional)', default: 'medium' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags (optional)' },
                target_date: { type: 'string', description: 'Target date in ISO format (optional)' },
                success_criteria: { type: 'array', items: { type: 'string' }, description: 'Success criteria (optional)' },
                linked_tasks: { type: 'array', items: { type: 'string' }, description: 'Related task IDs (optional)' }
              },
              required: ['title', 'description']
            }
          },
          {
            name: 'read_goal',
            description: 'Retrieve specific goal by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Goal ID' }
              },
              required: ['id']
            }
          },
          {
            name: 'update_goal',
            description: 'Update existing goal',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Goal ID' },
                status: { type: 'string', enum: ['planning', 'active', 'completed', 'on_hold', 'cancelled'], description: 'Goal status (optional)' },
                title: { type: 'string', description: 'Goal title (optional)' },
                description: { type: 'string', description: 'Goal description (optional)' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority (optional)' },
                target_date: { type: 'string', description: 'Target date in ISO format (optional)' },
                progress_note: { type: 'string', description: 'Progress note (optional)' },
                success_criteria: { type: 'array', items: { type: 'string' }, description: 'Success criteria (optional)' },
                linked_tasks: { type: 'array', items: { type: 'string' }, description: 'Related task IDs (optional)' }
              },
              required: ['id']
            }
          },
          {
            name: 'search_goals',
            description: 'Search goals by query',
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
            name: 'list_goals',
            description: 'List goals with optional filtering',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['planning', 'active', 'completed', 'on_hold', 'cancelled'], description: 'Filter by status (optional)' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter by priority (optional)' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (optional)' }
              }
            }
          },
          {
            name: 'delete_goal',
            description: 'Delete goal by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Goal ID' }
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
            const memory = await this.memoryManager.addMemory(args as AddMemoryArgs);
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
            const { id } = args as { id: string };
            const memory = await this.memoryManager.getMemory(id);
            
            if (!memory) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Memory ${id} does not exist.`
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
            const results = await this.memoryManager.searchMemory(args as SearchMemoryArgs);
            
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
            const memories = await this.memoryManager.listMemories(args as ListMemoriesArgs);

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
            const deleteArgs = args as DeleteMemoryArgs;
            const result = await this.memoryManager.deleteMemory(deleteArgs);
            
            return {
              content: [
                {
                  type: 'text',
                  text: result ? `Memory ${deleteArgs.id} deleted successfully.` : `Memory ${deleteArgs.id} does not exist.`
                }
              ]
            };
          }

          case 'create_goal': {
            const goal = await this.goalManager.createGoal(args as CreateGoalArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: `Goal ${goal.id} created successfully.\nTitle: ${goal.title}\nPriority: ${goal.priority}\nStatus: ${goal.status}\nNext: Use update_goal to set status to "active" when ready to start`
                }
              ]
            };
          }
          
          case 'read_goal': {
            const { id } = args as { id: string };
            const goal = await this.goalManager.getGoal({ id } as GetGoalArgs);
            
            if (!goal) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Goal ${id} does not exist.`
                  }
                ]
              };
            }

            const linkedTasksText = goal.linked_tasks.length > 0 ? 
              `Linked tasks:\n${goal.linked_tasks.map(id => `  - ${id}`).join('\n')}` : 
              'Linked tasks: None';
            
            const progressNotesText = goal.progress_notes.length > 0 ? 
              `Progress notes:\n${goal.progress_notes.map((note, i) => `  ${i + 1}. ${note}`).join('\n')}` : 
              'Progress notes: None';

            const successCriteriaText = goal.success_criteria.length > 0 ? 
              `Success criteria:\n${goal.success_criteria.map((criteria, i) => `  ${i + 1}. ${criteria}`).join('\n')}` : 
              'Success criteria: None';

            return {
              content: [
                {
                  type: 'text',
                  text: `Goal details:\nID: ${goal.id}\nTitle: ${goal.title}\nDescription: ${goal.description}\nStatus: ${goal.status}\nPriority: ${goal.priority}\nTags: ${goal.tags.join(', ')}\nCreated at: ${goal.created_at}\nLast updated: ${goal.updated_at}\nTarget date: ${goal.target_date || 'Not set'}\n${linkedTasksText}\n${progressNotesText}\n${successCriteriaText}`
                }
              ]
            };
          }
          
          case 'update_goal': {
            const goal = await this.goalManager.updateGoal(args as UpdateGoalArgs);
            
            if (!goal) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Goal ${(args as UpdateGoalArgs).id} does not exist.`
                  }
                ]
              };
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Goal ${goal.id} updated successfully.\nCurrent status: ${goal.status}\nLast updated: ${goal.updated_at}`
                }
              ]
            };
          }
          
          case 'search_goals': {
            const results = await this.goalManager.searchGoal(args as SearchGoalArgs);
            
            const truncateContent = (content: string, maxLength: number = 100) => {
              return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
            };
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${results.length} related goals:\n\n${results.map(r => 
                    `ID: ${r.goal.id}\nTitle: ${r.goal.title}\nDescription: ${truncateContent(r.goal.description)}\nStatus: ${r.goal.status}\nPriority: ${r.goal.priority}\nTags: ${r.goal.tags.join(', ')}\nCreated at: ${r.goal.created_at}\nSimilarity: ${r.similarity.toFixed(2)}\n---`
                  ).join('\n')}`
                }
              ]
            };
          }
          
          case 'list_goals': {
            const goals = await this.goalManager.listGoals(args as ListGoalsArgs);

            const truncateContent = (content: string, maxLength: number = 100) => {
              return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
            };

            return {
              content: [
                {
                  type: 'text',
                  text: `Total ${goals.length} goals:\n\n${goals.map(g => 
                    `ID: ${g.id}\nTitle: ${g.title}\nDescription: ${truncateContent(g.description)}\nStatus: ${g.status}\nPriority: ${g.priority}\nTags: ${g.tags.join(', ')}\nCreated at: ${g.created_at}\n---`
                  ).join('\n')}`
                }
              ]
            };
          }
          
          case 'delete_goal': {
            const deleteArgs = args as DeleteGoalArgs;
            const result = await this.goalManager.deleteGoal(deleteArgs);
            
            return {
              content: [
                {
                  type: 'text',
                  text: result ? `Goal ${deleteArgs.id} deleted successfully.` : `Goal ${deleteArgs.id} does not exist.`
                }
              ]
            };
          }

          case 'create_task': {
            const task = await this.taskManager.createTask(args as CreateTaskArgs);
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
            const { id } = args as { id: string };
            const task = await this.taskManager.getTaskStatus({ id } as GetTaskStatusArgs);
            
            if (!task) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Task ${id} does not exist.`
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
            const updateArgs = args as UpdateTaskArgs;
            const task = await this.taskManager.updateTask(updateArgs);
            
            if (!task) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Task ${updateArgs.id} does not exist.`
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
            const deleteArgs = args as DeleteTaskArgs;
            const result = await this.taskManager.deleteTask(deleteArgs);
            
            return {
              content: [
                {
                  type: 'text',
                  text: result ? `Task ${deleteArgs.id} deleted successfully.` : `Task ${deleteArgs.id} does not exist.`
                }
              ]
            };
          }
          
          case 'list_tasks': {
            const tasks = await this.taskManager.listTasks(args as ListTasksArgs);
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
            const tasks = await this.taskManager.searchTask(args as SearchTaskArgs);
            
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

          case 'overview': {
            // Reuse the logic from "overview://summary" resource
            const memories = await this.memoryManager.listMemories();
            const tasks = await this.taskManager.listTasks();
            const goals = await this.goalManager.listGoals();
        
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
            const goalCache = this.goalManager.getCacheStats();
            const totalHits = memoryCache.hits + taskCache.hits + goalCache.hits;
            const totalMisses = memoryCache.misses + taskCache.misses + goalCache.misses;
            const overallHitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses) * 100).toFixed(1) : '0.0';
        
            // Goal-Task relationship processing functions
            const buildGoalTaskMap = (goals: Goal[], tasks: Task[]) => {
                const goalTaskMap = new Map<string, Task[]>();
                
                // Initialize map with all goals
                goals.forEach(goal => {
                    goalTaskMap.set(goal.id, []);
                });
                
                // Add tasks to their respective goals
                tasks.forEach(task => {
                    if (task.goal_id && goalTaskMap.has(task.goal_id)) {
                        goalTaskMap.get(task.goal_id)!.push(task);
                    }
                });
                
                return goalTaskMap;
            };
            
            const findOrphanedTasks = (tasks: Task[]) => {
                return tasks.filter(task => !task.goal_id);
            };
            
            const calculateGoalProgress = (goal: Goal, tasks: Task[]) => {
                const goalTasks = tasks.filter(task => task.goal_id === goal.id);
                const completedTasks = goalTasks.filter(task => 
                    task.status === 'completed' || task.status === 'cancelled'
                );
                return { completed: completedTasks.length, total: goalTasks.length };
            };
            
            const getTaskStatusText = (task: Task, executableTasks: Task[]) => {
                switch (task.status) {
                    case 'completed': return 'DONE';
                    case 'in_progress': return 'ACTIVE';
                    case 'cancelled': return 'CANCELLED';
                    case 'todo':
                        return executableTasks.some(et => et.id === task.id) ? 'READY' : 'WAITING';
                    default: return task.status.toUpperCase();
                }
            };
        
            // Build Goal-Task relationships
            const goalTaskMap = buildGoalTaskMap(goals, tasks);
            const orphanedTasks = findOrphanedTasks(tasks);
        
            // Generate Goal-Task hierarchy overview
            const overview = `# Goal-Task System Overview

## Goal Progress Dashboard

${goals.length === 0 ? '*No goals found*' : 
    goals.filter(g => g.status === 'active' || g.status === 'planning').slice(0, 5).map(goal => {
        const progress = calculateGoalProgress(goal, tasks);
        const goalTasks = goalTaskMap.get(goal.id) || [];
        
        let goalSection = `### Goal-${goal.id}: (${progress.completed}/${progress.total}) - "${truncateText(goal.title)}"`;
        goalSection += `\n**Status:** ${goal.status.toUpperCase()} | **Priority:** ${goal.priority.toUpperCase()}`;
        
        if (goalTasks.length === 0) {
            goalSection += `\n└── *No tasks assigned to this goal*`;
        } else {
            goalTasks.forEach((task, index) => {
                const isLast = index === goalTasks.length - 1;
                const prefix = isLast ? '└──' : '├──';
                const statusText = getTaskStatusText(task, executableTasks);
                const dependsText = task.depends_on && task.depends_on.length > 0 ? ` (depends: ${task.depends_on.join(', ')})` : '';
                
                goalSection += `\n${prefix} Task-${task.id}: ${statusText} - "${truncateText(task.title, 50)}"${dependsText}`;
            });
        }
        
        return goalSection;
    }).join('\n\n')}

${orphanedTasks.length > 0 ? `
## Orphaned Tasks

${orphanedTasks.map(task => {
    const statusText = getTaskStatusText(task, executableTasks);
    const dependsText = task.depends_on && task.depends_on.length > 0 ? ` (depends: ${task.depends_on.join(', ')})` : '';
    return `Task-${task.id}: ${statusText} - "${truncateText(task.title)}"${dependsText} (No Goal assigned)`;
}).join('\n')}` : ''}

## Recent Memories

${memories.length === 0 ? '*No memories found*' : 
    memories.slice(0, 3).map((m, i) => 
        `${i + 1}. ${truncateText(m.summary)} (${m.id}) - ${m.metadata.created_at.split('T')[0]}`
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
**Goal Management:** ${goals.length > 0 ? `${goals.filter(g => g.status === 'active').length} active goals out of ${goals.length} total` : 'No goals'}  
**Task Management:** ${tasks.length > 0 ? `${activeTasks.length} active tasks out of ${tasks.length} total` : 'No tasks'}  
**Orphaned Tasks:** ${orphanedTasks.length > 0 ? `${orphanedTasks.length} tasks without goals` : 'All tasks assigned'}  
**Cache Efficiency:** ${parseFloat(overallHitRate) > 80 ? 'Excellent' : parseFloat(overallHitRate) > 60 ? 'Good' : parseFloat(overallHitRate) > 40 ? 'Fair' : 'Poor'}

## Next Actions Recommended

${(() => {
    if (goals.length === 0) {
        return '**Suggestion:** Start by creating your first goal using create_goal tool';
    }
    
    if (tasks.length === 0) {
        return '**Suggestion:** Create tasks for your goals using create_task tool with goal_id parameter';
    }
    
    if (orphanedTasks.length > 0) {
        return `**Priority:** Assign ${orphanedTasks.length} orphaned tasks to goals using update_task tool`;
    }
    
    if (executableTasks.length === 0) {
        return activeTasks.length === 0 ? 
            '**All tasks completed!** Consider creating new tasks or setting up new goals.' :
            '**No executable tasks found.** Check task dependencies or update task status.';
    }
    
    const activeGoalsWithTasks = goals.filter(g => g.status === 'active' && (goalTaskMap.get(g.id)?.length || 0) > 0);
    if (activeGoalsWithTasks.length > 0) {
        const recommendedGoal = activeGoalsWithTasks[0];
        const goalTasks = goalTaskMap.get(recommendedGoal.id) || [];
        const executableGoalTasks = goalTasks.filter(t => executableTasks.some(et => et.id === t.id));
        
        if (executableGoalTasks.length > 0) {
            return `**Focus on Goal-${recommendedGoal.id}:** "${truncateText(recommendedGoal.title, 40)}"\nReady tasks:\n${executableGoalTasks.slice(0, 3).map(t => 
                `- Task-${t.id}: ${truncateText(t.title, 50)}`
            ).join('\n')}`;
        }
    }
    
    return `**Ready to execute:** ${executableTasks.length} task(s) available\n${executableTasks.slice(0, 3).map(t => 
        `- Task-${t.id}: ${truncateText(t.title, 50)}`
    ).join('\n')}`;
})()}

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
