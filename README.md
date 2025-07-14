# MCP Memory & Task Management Server

## Overview

This is a complete implementation of a Model Context Protocol (MCP) server, providing memory and context management, as well as task and progress tracking functionalities. The server adopts a modular design and emphasizes a local-first data storage strategy.

## Features

### Memory & Context Management Module
- **Persistent Memory**: Local JSON file storage to ensure data privacy
- **Semantic Search**: Similarity calculation based on token overlap
- **Context Snapshots**: Automatically records and indexes context information
- **Tagging System**: Supports memory categorization and filtering

### Task & Progress Tracking Module
- **Task CRUD**: Full lifecycle management for tasks
- **Status Tracking**: todo, in progress, completed, cancelled
- **Priority Management**: Three levels—low, medium, high
- **Progress Notes**: Timestamped progress update records
- **Task Dependencies**: Support for task dependency relationships with `depends_on` field
- **Dependency Validation**: Prevents circular dependencies and validates executable tasks
- **Semantic Linking**: Mechanism to associate tasks with memories

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build & Run Server
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### 3. Test with MCP Inspector
```bash
npx @modelcontextprotocol/inspector ts-node src/index.ts
```

### 4. Add to MCP Client Configuration
```json
{
  "mcpServers": {
    "memory-task": {
      "command": "node",
      "args": ["/path/to/MemTask/dist/src/index.js"],
      "env": {
        "MCP_DATA_DIR": "/path/to/mcp_data"
      }
    }
  }
}
```

## Web Dashboard (Optional)

The server includes a web-based monitoring dashboard for managing memories and tasks through a browser interface.

### Start Dashboard
```bash
node web-viewer/server.js --data-dir ./mcp_data
# Access at http://localhost:8080
```

### Features
- **Task Management**: List view, Kanban board, and dependency visualization
- **Memory Browser**: Search and manage stored memories
- **Real-time Updates**: WebSocket-based live data synchronization
- **Visual Indicators**: Color-coded status badges and progress tracking

### Screenshots

#### Main Dashboard
![Monitoring Dashboard](image/dashboard.png)  
*Main monitoring interface with system overview*

#### Kanban Board View
![Kanban Board](image/Kanban_Board.png)  
*Visual task management with drag-and-drop workflow*

#### Dependencies View  
![Dependencies](image/Dependencies.png)  
*Task relationship visualization with status indicators*

#### Task Management Interface
![Task Management Interface](image/tasks.png)   
*Detailed task management with expandable information*

#### Memory Management Interface
![Memory Management Interface](image/memories.png)   
*Memory browser and search functionality*

#### Context Snapshots Interface
![Context Snapshots Interface](image/context_snapshots.png)   
*Context snapshot management and browsing*

## ⚠️ Breaking Changes in v2.0.0

**IMPORTANT**: Version 2.0.0 introduces breaking changes to improve LLM compatibility. The unified `memory_tool` and `task_tool` have been decomposed into 11 separate, operation-specific tools.

### What Changed
- **Old**: `memory_tool` with `operation` parameter → **New**: 5 separate memory tools
- **Old**: `task_tool` with `operation` parameter → **New**: 6 separate task tools

### Migration Required
If upgrading from v1.x, you **must** update all tool calls in your MCP client configuration. See the [MCP Usage Guide](#mcp-usage-guide) below for new tool usage examples.

### Tool Mapping
| v1.x Tool | v1.x Operation | v2.0 Tool |
|-----------|----------------|-----------|
| `memory_tool` | `"create"` | `create_memory` |
| `memory_tool` | `"read"` | `read_memory` |
| `memory_tool` | `"search"` | `search_memories` |
| `memory_tool` | `"list"` | `list_memories` |
| `memory_tool` | `"delete"` | `delete_memory` |
| `task_tool` | `"create"` | `create_task` |
| `task_tool` | `"read"` | `read_task` |
| `task_tool` | `"update"` | `update_task` |
| `task_tool` | `"search"` | `search_tasks` |
| `task_tool` | `"list"` | `list_tasks` |
| `task_tool` | `"delete"` | `delete_task` |

## MCP Usage Guide

### Memory Management

#### Create Memory
```json
{
  "tool": "create_memory",
  "arguments": {
    "content": "Meeting notes: Discussed new product feature planning",
    "summary": "Product feature meeting notes",
    "tags": ["meeting", "product"],
    "context_id": "optional-context-id"
  }
}
```

#### Read Memory
```json
{
  "tool": "read_memory",
  "arguments": {
    "id": "memory-id-123"
  }
}
```

#### Search Memories
```json
{
  "tool": "search_memories",
  "arguments": {
    "query": "product feature",
    "limit": 5
  }
}
```

#### List Memories
```json
{
  "tool": "list_memories",
  "arguments": {
    "tags": ["meeting"]
  }
}
```

#### Delete Memory
```json
{
  "tool": "delete_memory",
  "arguments": {
    "id": "memory-id-123"
  }
}
```

### Task Management

#### Create Task
```json
{
  "tool": "create_task",
  "arguments": {
    "title": "Complete product prototype",
    "description": "Build the product prototype based on meeting discussions",
    "priority": "high",
    "tags": ["development", "prototype"],
    "due_date": "2024-12-31T23:59:59Z",
    "linked_memories": ["memory-id-1", "memory-id-2"],
    "depends_on": ["task-id-1", "task-id-2"]
  }
}
```

#### Read Task
```json
{
  "tool": "read_task",
  "arguments": {
    "id": "task-id-456"
  }
}
```

#### Update Task
```json
{
  "tool": "update_task",
  "arguments": {
    "id": "task-id-456",
    "status": "in_progress",
    "progress_note": "Initial design completed"
  }
}
```

#### Search Tasks
```json
{
  "tool": "search_tasks",
  "arguments": {
    "query": "prototype development",
    "limit": 10
  }
}
```

#### List Tasks
```json
{
  "tool": "list_tasks",
  "arguments": {
    "status": "in_progress",
    "priority": "high"
  }
}
```

#### Delete Task
```json
{
  "tool": "delete_task",
  "arguments": {
    "id": "task-id-456"
  }
}
```

### Context Management

#### Create Context Snapshot
```json
{
  "tool": "create_context_snapshot",
  "arguments": {
    "summary": "Product development discussion context",
    "content": "Detailed conversation content...",
    "related_memories": ["memory-id-1"],
    "related_tasks": ["task-id-1"]
  }
}
```

### System Overview

#### Get System Overview
```json
{
  "tool": "overview",
  "arguments": {}
}
```

## Data Formats

All data is stored as JSON files in the `mcp_data/` directory:
- **Memories**: Content, summary, tags, timestamps, and optional context links
- **Tasks**: Title, description, status, priority, dependencies, and linked memories  
- **Context Snapshots**: Conversation summaries with related memories and tasks

For detailed schema information, see the TypeScript interfaces in `src/types.ts`.

## Integration Recommendations

### Integrating with MCP Client (v2.0)
1. **Important**: Ensure you're using v2.0 compatible configuration
2. Add this server to the MCP client configuration using the new tool names
3. Use the stdio protocol for communication
4. Manage memories and tasks via the 11 operation-specific tools

### MCP Client Configuration Example
```json
{
  "mcpServers": {
    "memory-task": {
      "command": "node",
      "args": ["/path/to/MemTask/dist/src/index.js"],
      "env": {
        "MCP_DATA_DIR": "/path/to/mcp_data"
      }
    }
  }
}
```

### Version Compatibility Notes
- **v2.0**: Uses 11 operation-specific tools (current)
- **v1.x**: Used unified `memory_tool` and `task_tool` (deprecated)
- **No backward compatibility** between major versions
