// Simple MemTask Viewer - Readonly Interface

// API endpoint configuration
const API_BASE = 'http://localhost:8080';  // Web viewer server port
const ENDPOINTS = {
  OVERVIEW: '/api/overview',
  TASKS: '/api/tasks',
  MEMORIES: '/api/memories',
  CONTEXTS: '/api/contexts'
};

// DOM Elements
const statsContainer = document.getElementById('stats');
const tasksContainer = document.getElementById('tasks-container');
const memoriesContainer = document.getElementById('memories-container');
const contextContainer = document.getElementById('context-container');

// Fetch data from web server
async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return null;
  }
}

// Format date for display
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

// Render system overview
function renderOverview(data) {
  if (!data) return;
  
  const statsHtml = `
    <div class="stat-card">
      <div class="stat-value">${data.memoriesCount}</div>
      <div class="stat-label">Memories</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.tasksCount}</div>
      <div class="stat-label">Tasks</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.contextsCount}</div>
      <div class="stat-label">Contexts</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.activeTasks}</div>
      <div class="stat-label">Active Tasks</div>
    </div>
  `;
  
  statsContainer.innerHTML = statsHtml;
}

// Render tasks
function renderTasks(tasks) {
  if (!tasks || !tasks.length) {
    tasksContainer.innerHTML = '<p>No tasks found</p>';
    return;
  }

  let html = '';
  tasks.forEach(task => {
    html += `
      <div class="task">
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span class="task-status">${task.status}</span>
          <span class="task-priority priority-${task.priority}">${task.priority}</span>
        </div>
      </div>
    `;
  });
  
  tasksContainer.innerHTML = html;
}

// Render memories
function renderMemories(memories) {
  if (!memories || !memories.length) {
    memoriesContainer.innerHTML = '<p>No memories found</p>';
    return;
  }

  let html = '';
  memories.forEach(memory => {
    html += `
      <div class="memory">
        <div class="memory-summary">${memory.summary}</div>
        <div>${formatDate(memory.metadata.created_at)}</div>
      </div>
    `;
  });
  
  memoriesContainer.innerHTML = html;
}

// Render contexts
function renderContexts(contexts) {
  if (!contexts || !contexts.length) {
    contextContainer.innerHTML = '<p>No context snapshots found</p>';
    return;
  }

  let html = '';
  contexts.forEach(context => {
    html += `
      <div class="context">
        <div class="context-summary">${context.summary}</div>
        <div>${formatDate(context.created_at)}</div>
      </div>
    `;
  });
  
  contextContainer.innerHTML = html;
}

// Initialize the viewer
async function initViewer() {
  // Load all data in parallel
  const [overview, tasks, memories, contexts] = await Promise.all([
    fetchData(ENDPOINTS.OVERVIEW),
    fetchData(ENDPOINTS.TASKS),
    fetchData(ENDPOINTS.MEMORIES),
    fetchData(ENDPOINTS.CONTEXTS)
  ]);

  // Render all sections
  renderOverview(overview);
  renderTasks(tasks);
  renderMemories(memories);
  renderContexts(contexts);
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initViewer);
