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
  const detailsContainer = document.getElementById(`details-${type}-${id}`);
  
  // Only toggle if not clicking on content area or elements with data-ignore-toggle
  if (!event.target.closest('.content-area') && !event.target.closest('[data-ignore-toggle]')) {
    if (detailsContainer.style.display === 'none') {
      // Show details
      const detailData = await fetchData(`/api/${type}/${id}`);
      if (detailData) {
        renderDetails(detailsContainer, detailData, type);
        detailsContainer.style.display = 'block';
        element.classList.add('expanded');
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
  
  console.log('Connecting to WebSocket...');
  ws = new WebSocket(WS_BASE);
  
  ws.onopen = function() {
    console.log('WebSocket connected');
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
      console.log('WebSocket message received:', message);
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onclose = function() {
    console.log('WebSocket disconnected');
    updateConnectionStatus('disconnected');
    
    // Attempt to reconnect after 3 seconds
    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        console.log('Attempting to reconnect WebSocket...');
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
  
  console.log(`Received ${type} update at ${timestamp}`);
  
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
  console.log('Refreshing all data...');
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
