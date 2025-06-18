// Simple MemTask Viewer - Readonly Interface

// API endpoint configuration
const API_BASE = 'http://localhost:8080';  // Web viewer server port
const WS_BASE = 'ws://localhost:8080';     // WebSocket server
const ENDPOINTS = {
  OVERVIEW: '/api/overview',
  TASKS: '/api/tasks',
  MEMORIES: '/api/memories',
  CONTEXTS: '/api/contexts'
};

// WebSocket connection
let ws = null;
let reconnectInterval = null;

// View state management
let currentView = 'list'; // 'list' or 'kanban'
let currentTasks = []; // Store current tasks data for view switching

// DOM Elements
const statsContainer = document.getElementById('stats');
const kanbanProgressContainer = document.getElementById('kanban-progress');
const tasksContainer = document.getElementById('tasks-container');
const memoriesContainer = document.getElementById('memories-container');
const contextContainer = document.getElementById('context-container');

// View elements
const listViewBtn = document.getElementById('list-view-btn');
const kanbanViewBtn = document.getElementById('kanban-view-btn');
const dashboardContainer = document.querySelector('.dashboard-container');
const kanbanContainer = document.getElementById('kanban-container');

// Fetch data from web server
async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch data from ${endpoint}:`, error);
    return null;
  }
}

// Format date for display as YYYY/MM/DD HH:mm:ss
function formatDate(dateString) {
  const dateObj = new Date(dateString);
  
  // Return empty string for invalid dates
  if (isNaN(dateObj.getTime())) return '';
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// Render system overview
function renderOverview(data) {
  if (!data) return;
  
  const statsHtml = `
    <div class="stat-card">
      <div class="stat-value">${data.tasksCount}</div>
      <div class="stat-label">Tasks</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.memoriesCount}</div>
      <div class="stat-label">Memories</div>
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
  
  // Update List View stats
  if (statsContainer) {
    statsContainer.innerHTML = statsHtml;
  }
}

// Render Kanban progress bar
function renderKanbanProgress(tasks) {
  if (!kanbanProgressContainer) return;
  
  // Default empty state
  if (!tasks || tasks.length === 0) {
    kanbanProgressContainer.innerHTML = `
      <div class="progress-summary">
        <span><strong>0 Tasks Total</strong></span>
        <span>Completion Rate: 0%</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar">
          <div class="progress-segment" style="width: 100%; background-color: #f8f9fa; color: #6c757d;">
            No Tasks
          </div>
        </div>
      </div>
      <div class="progress-legend">
        <div class="legend-item">
          <div class="legend-color progress-todo"></div>
          <span>Todo (0)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color progress-in-progress"></div>
          <span>In Progress (0)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color progress-completed"></div>
          <span>Completed (0)</span>
        </div>
      </div>
    `;
    return;
  }
  
  // Calculate task counts by status
  const todoTasks = tasks.filter(task => task.status === 'todo');
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
  const completedTasks = tasks.filter(task => task.status === 'completed' || task.status === 'cancelled');
  
  const totalTasks = tasks.length;
  const completedCount = completedTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  
  // Calculate percentages for progress bar
  const todoPercent = totalTasks > 0 ? (todoTasks.length / totalTasks) * 100 : 0;
  const inProgressPercent = totalTasks > 0 ? (inProgressTasks.length / totalTasks) * 100 : 0;
  const completedPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
  
  const progressHtml = `
    <div class="progress-summary">
      <span><strong>${totalTasks} Tasks Total</strong></span>
      <span>Completion Rate: ${completionRate}%</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar">
        ${todoPercent > 0 ? `
          <div class="progress-segment progress-todo" 
               style="width: ${todoPercent}%"
               title="Todo: ${todoTasks.length} tasks">
            ${todoTasks.length > 0 ? todoTasks.length : ''}
          </div>
        ` : ''}
        ${inProgressPercent > 0 ? `
          <div class="progress-segment progress-in-progress" 
               style="width: ${inProgressPercent}%"
               title="In Progress: ${inProgressTasks.length} tasks">
            ${inProgressTasks.length > 0 ? inProgressTasks.length : ''}
          </div>
        ` : ''}
        ${completedPercent > 0 ? `
          <div class="progress-segment progress-completed" 
               style="width: ${completedPercent}%"
               title="Completed: ${completedCount} tasks">
            ${completedCount > 0 ? completedCount : ''}
          </div>
        ` : ''}
      </div>
    </div>
    <div class="progress-legend">
      <div class="legend-item">
        <div class="legend-color progress-todo"></div>
        <span>Todo (${todoTasks.length})</span>
      </div>
      <div class="legend-item">
        <div class="legend-color progress-in-progress"></div>
        <span>In Progress (${inProgressTasks.length})</span>
      </div>
      <div class="legend-item">
        <div class="legend-color progress-completed"></div>
        <span>Completed (${completedCount})</span>
      </div>
    </div>
  `;
  
  kanbanProgressContainer.innerHTML = progressHtml;
}

// View management functions
function initializeViewToggle(tasks) {
  // Load saved view preference
  const savedView = localStorage.getItem('memtask-view') || 'list';
  switchToView(savedView, tasks);
  
  // Add event listeners
  listViewBtn.addEventListener('click', () => {
    switchToView('list');
  });
  kanbanViewBtn.addEventListener('click', () => {
    switchToView('kanban', currentTasks);
  });
}

function switchToView(view, tasks = null) {
  currentView = view;
  localStorage.setItem('memtask-view', view);
  
  // Update button states
  listViewBtn.classList.toggle('active', view === 'list');
  kanbanViewBtn.classList.toggle('active', view === 'kanban');
  
  // Show/hide containers
  if (view === 'list') {
    // List view: show full dashboard container
    dashboardContainer.style.display = 'flex';
    kanbanContainer.style.display = 'none';
    // Restore widgets row
    const widgetsRow = document.querySelector('.widgets-row');
    if (widgetsRow) {
      widgetsRow.style.display = 'flex';
    }
  } else {
    // Kanban view: hide dashboard container completely, show only kanban
    dashboardContainer.style.display = 'none';
    kanbanContainer.style.display = 'flex';
    
    // Render kanban with provided tasks data or fetch new data
    if (tasks) {
      renderKanbanBoard(tasks);
      renderKanbanProgress(tasks);
    } else {
      refreshKanbanBoard();
    }
  }
}

// Render tasks (modified to support both views)
function renderTasks(tasks) {
  // Store current tasks data
  currentTasks = tasks || [];
  
  if (!tasks || !tasks.length) {
    tasksContainer.innerHTML = '<p>No tasks found</p>';
    if (currentView === 'kanban') {
      renderKanbanBoard([]);
    }
    return;
  }

  // Always update list view
  let html = '';
  tasks.forEach(task => {
    html += `
      <div class="task clickable" data-id="${task.id}" data-type="tasks">
        <div class="card-header">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="task-status">${task.status}</span>
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
          </div>
        </div>
        <div class="details-container content-area" id="details-tasks-${task.id}" style="display: none;"></div>
      </div>
    `;
  });
  
  tasksContainer.innerHTML = html;
  addClickListeners();
  
  // Update kanban view if currently active
  if (currentView === 'kanban') {
    renderKanbanBoard(tasks);
    renderKanbanProgress(tasks);
  }
}

// Render Kanban Board
function renderKanbanBoard(tasks) {
  // First, check if kanban container exists and is visible
  const kanbanContainer = document.getElementById('kanban-container');
  if (!kanbanContainer) {
    console.error('kanban-container not found in DOM!');
    return;
  }
  
  if (!tasks) {
    tasks = [];
  }
  
  // Group tasks by status
  const tasksByStatus = {
    todo: tasks.filter(task => task.status === 'todo'),
    in_progress: tasks.filter(task => task.status === 'in_progress'),
    completed: tasks.filter(task => task.status === 'completed' || task.status === 'cancelled')
  };
  
  // Render each column
  Object.keys(tasksByStatus).forEach(status => {
    const containerId = `kanban-${status.replace('_', '-')}`;
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Kanban container not found: ${containerId}`);
      return;
    }
    
    const statusTasks = tasksByStatus[status];
    
    // Always set some content, even if no tasks
    if (statusTasks.length === 0) {
      const noTasksHTML = '<p style="text-align: center; color: #7f8c8d; font-style: italic; padding: 20px; background: #f8f9fa; border-radius: 4px; margin: 10px 0;">No tasks</p>';
      container.innerHTML = noTasksHTML;
    } else {
      let html = '';
      statusTasks.forEach(task => {
        html += `
          <div class="kanban-task clickable" data-id="${task.id}" data-type="tasks" style="background: #fff; padding: 12px; margin: 8px 0; border-radius: 6px; border: 1px solid #ddd;">
            <div class="kanban-task-title" style="font-weight: bold; margin-bottom: 8px;">${task.title}</div>
            <div class="kanban-task-meta">
              <span class="kanban-task-priority priority-${task.priority}" style="padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; background: #3498db; color: white;">${task.priority}</span>
            </div>
            <div class="details-container content-area" id="details-kanban-tasks-${task.id}" style="display: none;"></div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    }
  });
  
  // Add click listeners for kanban tasks
  addClickListeners();
}


async function refreshKanbanBoard() {
  try {
    const tasks = await fetchData(ENDPOINTS.TASKS);
    if (tasks) {
      renderKanbanBoard(tasks);
      renderKanbanProgress(tasks);
    } else {
      renderKanbanBoard([]); // Render empty kanban
      renderKanbanProgress([]); // Render empty progress
    }
  } catch (error) {
    console.error('Error refreshing kanban board:', error);
    renderKanbanBoard([]); // Render empty kanban on error
    renderKanbanProgress([]); // Render empty progress on error
  }
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
      <div class="memory clickable" data-id="${memory.id}" data-type="memories">
        <div class="card-header">
          <div class="memory-summary">${memory.summary}</div>
          <div>${formatDate(memory.created_at)}</div>
        </div>
        <div class="details-container content-area" id="details-memories-${memory.id}" style="display: none;"></div>
      </div>
    `;
  });
  
  memoriesContainer.innerHTML = html;
  addClickListeners();
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
      <div class="context clickable" data-id="${context.id}" data-type="contexts">
        <div class="card-header">
          <div class="context-summary">${context.summary}</div>
          <div>${formatDate(context.created_at)}</div>
        </div>
        <div class="details-container content-area" id="details-contexts-${context.id}" style="display: none;"></div>
      </div>
    `;
  });
  
  contextContainer.innerHTML = html;
  addClickListeners();
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

// Add click listeners to all clickable elements
function addClickListeners() {
  const clickableElements = document.querySelectorAll('.clickable');
  clickableElements.forEach(element => {
    element.addEventListener('click', handleItemClick);
  });
}

// Handle item click to show/hide details
async function handleItemClick(event) {
  const element = event.currentTarget;
  const id = element.dataset.id;
  const type = element.dataset.type;
  
  // Determine the correct details container ID based on the element type
  let detailsContainerId;
  if (element.classList.contains('kanban-task')) {
    detailsContainerId = `details-kanban-${type}-${id}`;
  } else {
    detailsContainerId = `details-${type}-${id}`;
  }
  
  const detailsContainer = document.getElementById(detailsContainerId);
  
  if (!detailsContainer) {
    console.error(`Details container not found: ${detailsContainerId}`);
    return;
  }
  
  // Only toggle if not clicking on content area or elements with data-ignore-toggle
  if (!event.target.closest('.content-area') && !event.target.closest('[data-ignore-toggle]')) {
    if (detailsContainer.style.display === 'none' || !detailsContainer.style.display) {
      // Show details
      const detailData = await fetchData(`/api/${type}/${id}`);
      if (detailData) {
        renderDetails(detailsContainer, detailData, type);
        detailsContainer.style.display = 'block';
        element.classList.add('expanded');
      } else {
        console.error('Failed to fetch detail data for:', type, id);
      }
    } else {
      // Hide details
      detailsContainer.style.display = 'none';
      element.classList.remove('expanded');
    }
  }
}

// Render detailed information
function renderDetails(container, data, type) {
  let html = '';
  
  // Add ID display for all item types
  const idHtml = `<div class="detail-section"><strong>ID:</strong> ${data.id}</div>`;
  
  switch (type) {
    case 'tasks':
      html = `
        <div class="details">
          ${idHtml}
          <div class="detail-section">
            <strong>Description:</strong>
            <p>${data.description || 'No description available'}</p>
          </div>
          <div class="detail-section">
            <strong>Created:</strong> ${formatDate(data.created_at)}
          </div>
          <div class="detail-section">
            <strong>Last Updated:</strong> ${formatDate(data.updated_at)}
          </div>
          ${data.due_date ? `<div class="detail-section"><strong>Due Date:</strong> ${formatDate(data.due_date)}</div>` : ''}
          ${data.tags && data.tags.length ? `<div class="detail-section"><strong>Tags:</strong> ${data.tags.join(', ')}</div>` : ''}
          ${data.linked_memories && data.linked_memories.length ? `<div class="detail-section"><strong>Linked Memories:</strong> ${data.linked_memories.length} items</div>` : ''}
          ${data.progress_notes && data.progress_notes.length ? 
            `<div class="detail-section"><strong>Progress Notes:</strong><ul>
              ${data.progress_notes.map(noteString => {
                // Parse ISO timestamp and note text from string
                // Format is "2024-05-29T12:34:56.789Z: Note text"
                const isoPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z): (.*)$/;
                const match = noteString.match(isoPattern);
                
                if (match) {
                  const timestamp = match[1];
                  const noteText = match[2];
                  return `<li>(${formatDate(timestamp)}) ${noteText}</li>`;
                } else {
                  // Fallback: Use entire string as note
                  return `<li>${noteString}</li>`;
                }
              }).join('')}
            </ul></div>` 
          : ''}
        </div>
      `;
      break;
    case 'memories':
      html = `
        <div class="details">
          ${idHtml}
          <div class="detail-section">
            <strong>Content:</strong>
            <p>${data.content || 'No content available'}</p>
          </div>
          <div class="detail-section">
            <strong>Created:</strong> ${formatDate(data.metadata.created_at)}
          </div>
          <div class="detail-section">
            <strong>Last Updated:</strong> ${formatDate(data.metadata.updated_at)}
          </div>
          ${data.tags && data.tags.length ? `<div class="detail-section"><strong>Tags:</strong> ${data.tags.join(', ')}</div>` : ''}
          ${data.context_id ? `<div class="detail-section"><strong>Context ID:</strong> ${data.context_id}</div>` : ''}
        </div>
      `;
      break;
    case 'contexts':
      html = `
        <div class="details">
          ${idHtml}
          <div class="detail-section">
            <strong>Content:</strong>
            <p class="scrollable-content">${data.content || 'No content available'}</p>
          </div>
          <div class="detail-section">
            <strong>Created:</strong> ${formatDate(data.created_at)}
          </div>
          ${data.related_memories && data.related_memories.length ? `<div class="detail-section"><strong>Related Memories:</strong><ul>${data.related_memories.map(id => `<li>${id}</li>`).join('')}</ul></div>` : ''}
          ${data.related_tasks && data.related_tasks.length ? `<div class="detail-section"><strong>Related Tasks:</strong><ul>${data.related_tasks.map(id => `<li>${id}</li>`).join('')}</ul></div>` : ''}
        </div>
      `;
      break;
    default:
      html = '<div class="details">Unknown item type</div>';
  }
  
  container.innerHTML = html;
}

// WebSocket functionality
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  
  ws = new WebSocket(WS_BASE);
  
  ws.onopen = function() {
    updateConnectionStatus('connected');
    
    // Clear any existing reconnect interval
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };
  
  ws.onmessage = function(event) {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onclose = function() {
    updateConnectionStatus('disconnected');
    
    // Attempt to reconnect after 3 seconds
    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        connectWebSocket();
      }, 3000);
    }
  };
  
  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
    updateConnectionStatus('error');
  };
}

// Handle WebSocket messages
function handleWebSocketMessage(message) {
  const { type, data, timestamp } = message;
  
  // Add visual feedback for updates
  showUpdateNotification(type, timestamp);
  
  // Refresh the appropriate section based on the update type
  switch (type) {
    case 'memories':
      refreshMemories();
      break;
    case 'tasks':
      refreshTasks();
      break;
    case 'contexts':
      refreshContexts();
      break;
    case 'refresh':
    default:
      refreshAllData();
      break;
  }
}

// Refresh specific sections
async function refreshMemories() {
  const memories = await fetchData(ENDPOINTS.MEMORIES);
  if (memories) {
    renderMemories(memories);
  }
  // Also update overview stats
  refreshOverview();
}

async function refreshTasks() {
  const tasks = await fetchData(ENDPOINTS.TASKS);
  if (tasks) {
    renderTasks(tasks);
    // Also update kanban if in kanban view
    if (currentView === 'kanban') {
      renderKanbanBoard(tasks);
      renderKanbanProgress(tasks);
    }
  }
  // Also update overview stats
  refreshOverview();
}

async function refreshContexts() {
  const contexts = await fetchData(ENDPOINTS.CONTEXTS);
  if (contexts) {
    renderContexts(contexts);
  }
  // Also update overview stats
  refreshOverview();
}

async function refreshOverview() {
  const overview = await fetchData(ENDPOINTS.OVERVIEW);
  if (overview) {
    renderOverview(overview);
  }
}

async function refreshAllData() {
  await initViewer();
}

// Update connection status indicator
function updateConnectionStatus(status) {
  let statusElement = document.getElementById('connection-status');
  if (!statusElement) {
    // Create status indicator if it doesn't exist
    statusElement = document.createElement('div');
    statusElement.id = 'connection-status';
    statusElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: bold;
      z-index: 1000;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(statusElement);
  }
  
  switch (status) {
    case 'connected':
      statusElement.textContent = '🟢 Live';
      statusElement.style.backgroundColor = '#d4edda';
      statusElement.style.color = '#155724';
      statusElement.style.border = '1px solid #c3e6cb';
      break;
    case 'disconnected':
      statusElement.textContent = '🔴 Offline';
      statusElement.style.backgroundColor = '#f8d7da';
      statusElement.style.color = '#721c24';
      statusElement.style.border = '1px solid #f5c6cb';
      break;
    case 'error':
      statusElement.textContent = '⚠️ Error';
      statusElement.style.backgroundColor = '#fff3cd';
      statusElement.style.color = '#856404';
      statusElement.style.border = '1px solid #ffeaa7';
      break;
  }
}

// Show update notification
function showUpdateNotification(type, timestamp) {
  let notification = document.getElementById('update-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      padding: 10px 15px;
      background-color: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
      border-radius: 5px;
      font-size: 14px;
      z-index: 1001;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 300px;
    `;
    document.body.appendChild(notification);
  }
  
  const updateTime = new Date(timestamp).toLocaleTimeString();
  notification.textContent = `Updated ${type} at ${updateTime}`;
  notification.style.opacity = '1';
  
  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 3000);
}

// Enhanced initialization
async function initViewer() {
  // Load all data in parallel first
  const [overview, tasks, memories, contexts] = await Promise.all([
    fetchData(ENDPOINTS.OVERVIEW),
    fetchData(ENDPOINTS.TASKS),
    fetchData(ENDPOINTS.MEMORIES),
    fetchData(ENDPOINTS.CONTEXTS)
  ]);

  // Render all sections
  renderOverview(overview);
  renderMemories(memories);
  renderTasks(tasks);
  renderContexts(contexts);
  
  // Initialize view toggle after data is loaded
  initializeViewToggle(tasks);
  
  // Connect to WebSocket for real-time updates
  connectWebSocket();
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initViewer);

// Clean up WebSocket on page unload
window.addEventListener('beforeunload', () => {
  if (ws) {
    ws.close();
  }
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }
});
