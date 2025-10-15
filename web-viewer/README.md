# MemTask Web Viewer

Local-first web dashboard for visualizing and managing MemTask goals, tasks, and memories.

## Features

### 🎯 Goal Management
- Visual goal cards with status, priority, and progress tracking
- Success criteria display
- Task completion progress bars
- Goal filtering and search

### 📋 Task Kanban Board
- Drag-free kanban board with 4 columns (To Do, In Progress, Completed, Cancelled)
- Visual dependency arrows between tasks
- Goal linkage display
- Due date tracking with overdue indicators
- Priority badges

### 💭 Memory Browser
- Full-text memory search
- Tag filtering
- Recent memories display
- Memory content preview

### 🔄 Real-time Updates
- Auto-polling data refresh (every 5 seconds)
- Exponential backoff on errors
- Manual refresh button
- Last sync timestamp

### 🎨 Modern UI
- Clean, responsive design
- Dark mode support (system preference)
- Accessible (WCAG 2.1 compliant)
- Keyboard shortcuts

## Quick Start

### Prerequisites
- Node.js >=16.0.0
- MemTask MCP server running
- MemTask data directory (`mcp_data/`)

### Installation

1. Navigate to web-viewer directory:
```bash
cd web-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

Or with custom data directory:
```bash
node server.js --data-dir /path/to/mcp_data
```

4. Open browser:
```
http://localhost:8080
```

## Configuration

### Environment Variables

```bash
# Data directory path (default: ../mcp_data)
DATA_DIR=/path/to/mcp_data

# Server port (default: 8080)
PORT=3000

# Polling interval in ms (default: 5000)
POLL_INTERVAL=5000
```

### Server Options

```bash
node server.js [options]

Options:
  --data-dir <path>   Path to MemTask data directory (default: ../mcp_data)
  --port <number>     Server port (default: 8080)
  --host <string>     Server host (default: localhost)
  --help              Show help message
```

## Architecture

### Project Structure

```
web-viewer/
├── server.js              # Express server with REST API
├── package.json           # Node.js dependencies
├── index.html             # Main HTML entry point
├── scripts/               # JavaScript modules (ES6)
│   ├── main.js           # Application entry point
│   ├── data-loader.js    # Data fetching and polling
│   ├── goal-renderer.js  # Goal card rendering
│   ├── task-kanban.js    # Kanban board rendering
│   ├── logger.js         # Logging utility
│   └── utils.js          # Shared utilities
└── styles/                # CSS modules
    ├── base.css          # Base styles and variables
    ├── layout.css        # Layout and grid
    ├── components.css    # Reusable components
    ├── goal-view.css     # Goal-specific styles
    ├── task-kanban.css   # Kanban-specific styles
    └── memory-search.css # Memory browser styles
```

### Module Responsibilities

#### `server.js`
- Express.js REST API server
- Serves static files
- Provides JSON endpoints for goals, tasks, memories
- Reads from MemTask data directory

#### `data-loader.js`
- Fetches data from `/api` endpoints
- Auto-polling with exponential backoff
- Event-driven data updates
- Error handling and retry logic

#### `main.js`
- Application initialization
- Event listener setup
- Global state management
- Coordinates all modules

#### `goal-renderer.js`
- Renders goal cards
- Calculates task progress
- Handles goal interactions
- Goal detail modal

#### `task-kanban.js`
- Renders kanban columns
- Draws dependency arrows (SVG)
- Task card interactions
- Task detail modal

#### `logger.js`
- Centralized logging
- Log levels (DEBUG, INFO, WARN, ERROR)
- Console output with timestamps

#### `utils.js`
- Date formatting utilities
- Debounce function
- Deep equality comparison
- HTML escaping

## API Endpoints

### Goals
```
GET /api/goals
Returns all goals as JSON array
```

### Tasks
```
GET /api/tasks
Returns all tasks as JSON array
```

### Memories
```
GET /api/memories
Returns all memories as JSON array
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus global search |
| `Ctrl+R` | Force refresh data |
| `Esc` | Close modal |

## Features in Detail

### Auto-polling
The dashboard automatically polls for data updates every 5 seconds. On consecutive errors, the polling interval increases exponentially up to 60 seconds.

### Dependency Visualization
Task dependencies are visualized using SVG arrows connecting task cards. The arrows dynamically update when tasks move or filters change.

### Filtering System
- **Status Filter**: Filter tasks by status (To Do, In Progress, etc.)
- **Priority Filter**: Filter by priority level (Low, Medium, High)
- **Goal Filter**: Show tasks for specific goals
- **Search**: Full-text search across goals, tasks, and memories

### Progress Tracking
Goal cards display:
- Number of linked tasks
- Completed vs total tasks
- Visual progress bar
- Percentage completion

### Overdue Detection
Tasks and goals with past due dates are automatically highlighted with a red color indicator.

## Development

### Running in Development Mode

```bash
# Start with auto-reload (if using nodemon)
npm run dev
```

### Debugging

Enable debug logging by opening browser console and setting:
```javascript
localStorage.setItem('logLevel', 'DEBUG');
```

Or edit `main.js`:
```javascript
logger.setLevel(LogLevel.DEBUG);
```

### Testing

```bash
# Run tests (if configured)
npm test

# Lint code
npm run lint
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires:
- ES6 module support
- Fetch API
- CSS Grid
- CSS Custom Properties

## Accessibility

The dashboard follows WCAG 2.1 Level AA guidelines:
- Semantic HTML5
- ARIA labels and roles
- Keyboard navigation
- Focus indicators
- High contrast mode support

## Performance

### Optimizations
- Debounced search inputs (300ms)
- Lazy rendering for large lists
- Event delegation for card interactions
- Minimal DOM updates (change detection)

### Resource Usage
- Initial load: ~200KB (uncompressed)
- Memory usage: ~10MB for 1000 items
- CPU: <5% during auto-polling

## Troubleshooting

### Dashboard shows "Loading..." forever
- Check if MemTask data directory exists
- Verify server is running on correct port
- Check browser console for errors
- Ensure data directory has read permissions

### Tasks not showing
- Verify tasks have `goal_id` field
- Check if filters are applied
- Look for JavaScript errors in console

### Dependency arrows not showing
- Check if tasks have `depends_on` array
- Verify referenced task IDs exist
- Ensure SVG element is present in DOM

### Auto-polling not working
- Check browser console for network errors
- Verify `/api` endpoints are accessible
- Check if polling was stopped (rare)

## Security Considerations

### Local-First Architecture
- **No external data transmission**: All data stays on your machine
- **No authentication required**: Dashboard assumes trusted local network
- **Read-only access**: Dashboard only reads data, never modifies

### For Production Deployment
If deploying to a network:
1. Add authentication middleware
2. Enable HTTPS
3. Implement CORS policies
4. Add rate limiting
5. Sanitize all user inputs

## Future Enhancements

Planned features:
- [ ] Drag-and-drop task reordering
- [ ] Inline task/goal editing
- [ ] Memory semantic search
- [ ] Export to PDF/CSV
- [ ] Custom themes
- [ ] Dashboard widgets
- [ ] Offline mode with ServiceWorker
- [ ] WebSocket for real-time updates

## Contributing

This is part of the MemTask project. See main project README for contribution guidelines.

## License

MIT License - See main project LICENSE file

## Related Links

- [MemTask Main Project](https://github.com/KNChiu/MemTask)
- [MCP Documentation](https://modelcontextprotocol.io/)
- [Issue Tracker](https://github.com/KNChiu/MemTask/issues)

## Version History

### v2.2.0 (Current)
- Initial web viewer release
- Goal-Task-Memory three-layer visualization
- Kanban board with dependency arrows
- Auto-polling with exponential backoff
- Responsive design with dark mode

---

**Built with ❤️ for the MemTask ecosystem**
