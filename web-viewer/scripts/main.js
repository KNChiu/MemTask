/**
 * Main Application Entry Point
 *
 * Orchestrates the entire dashboard:
 * - Initialize all modules
 * - Set up event listeners
 * - Coordinate data flow
 * - Handle global interactions
 */

import { logger, LogLevel } from './logger.js';
import { dataLoader } from './data-loader.js';
import { formatRelativeTime, debounce, escapeHtml } from './utils.js';
import { renderGoalCard, renderGoalDetailModal, setupGoalCardListeners } from './goal-renderer.js';
import { renderKanban as renderKanbanBoard, renderTaskDetailModal, setupKanbanListeners, clearKanban as clearKanbanBoard } from './task-kanban.js';

// Enable debug logging in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  logger.setLevel(LogLevel.DEBUG);
}

/**
 * Application State
 */
const appState = {
  filters: {
    search: '',
    status: new Set(),
    priority: new Set(),
    goals: new Set()
  },
  selectedGoal: null,
  isLoading: false,
  navigationPath: [] // Breadcrumb navigation path: [{type, id, title}, ...]
};

/**
 * Maximum depth of navigation path for breadcrumb display
 */
const MAX_PATH_DEPTH = 5;

/**
 * DOM Elements Cache
 */
const elements = {
  // Header
  globalSearch: null,
  refreshBtn: null,
  lastUpdate: null,

  // Filters
  statusFilters: null,
  priorityFilters: null,
  goalFilters: null,
  clearFiltersBtn: null,

  // Goals
  goalCardsContainer: null,
  goalCount: null,
  goalsEmptyState: null,

  // Tasks
  kanbanBoard: null,
  taskCount: null,
  tasksEmptyState: null,
  dependencySvg: null,

  // Memories
  memorySearch: null,
  memoryTags: null,
  memoryList: null,
  memoryCount: null,
  memoriesEmptyState: null,

  // UI Components
  loadingIndicator: null,
  toastContainer: null,
  modalContainer: null,
  modalBody: null,
  modalBreadcrumb: null
};

/**
 * Initialize Application
 */
async function init() {
  logger.info('App', 'Initializing MemTask Dashboard');

  try {
    // Cache DOM elements
    cacheElements();

    // Set up event listeners
    setupEventListeners();

    // Initialize data loader
    showLoading();
    await dataLoader.init();
    hideLoading();

    // Initial render
    renderAll();

    // Update last sync time
    updateLastSyncTime();

    logger.info('App', 'Dashboard initialized successfully');
  } catch (error) {
    logger.error('App', 'Failed to initialize dashboard', error);
    hideLoading();
    showToast('Failed to load data. Please refresh the page.', 'error');
  }
}

/**
 * Cache DOM element references
 */
function cacheElements() {
  // Header
  elements.globalSearch = document.getElementById('global-search');
  elements.refreshBtn = document.getElementById('refresh-btn');
  elements.lastUpdate = document.getElementById('last-update');

  // Filters
  elements.statusFilters = document.getElementById('status-filters');
  elements.priorityFilters = document.getElementById('priority-filters');
  elements.goalFilters = document.getElementById('goal-filters');
  elements.clearFiltersBtn = document.getElementById('clear-filters-btn');

  // Goals
  elements.goalCardsContainer = document.getElementById('goal-cards-container');
  elements.goalCount = document.getElementById('goal-count');
  elements.goalsEmptyState = document.getElementById('goals-empty-state');

  // Tasks
  elements.kanbanBoard = document.getElementById('kanban-board');
  elements.taskCount = document.getElementById('task-count');
  elements.tasksEmptyState = document.getElementById('tasks-empty-state');
  elements.dependencySvg = document.getElementById('dependency-svg');

  // Memories
  elements.memorySearch = document.getElementById('memory-search');
  elements.memoryTags = document.getElementById('memory-tags');
  elements.memoryList = document.getElementById('memory-list');
  elements.memoryCount = document.getElementById('memory-count');
  elements.memoriesEmptyState = document.getElementById('memories-empty-state');

  // UI Components
  elements.loadingIndicator = document.getElementById('loading-indicator');
  elements.toastContainer = document.getElementById('toast-container');
  elements.modalContainer = document.getElementById('modal-container');
  elements.modalBody = document.getElementById('modal-body');
  elements.modalBreadcrumb = document.getElementById('modal-breadcrumb');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Data loader events
  dataLoader.on('data:updated', handleDataUpdate);
  dataLoader.on('data:refreshed', handleDataRefresh);
  dataLoader.on('data:error', handleDataError);

  // Global search
  elements.globalSearch.addEventListener('input', debounce(handleGlobalSearch, 300));

  // Refresh button
  elements.refreshBtn.addEventListener('click', handleRefresh);

  // Clear filters button
  elements.clearFiltersBtn.addEventListener('click', handleClearFilters);

  // Memory search
  elements.memorySearch.addEventListener('input', debounce(handleMemorySearch, 300));

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Modal close
  elements.modalContainer.querySelector('.modal-close').addEventListener('click', closeModal);
  elements.modalContainer.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  // Update last sync time periodically
  setInterval(updateLastSyncTime, 10000); // Update every 10 seconds
}

/**
 * Handle data update
 */
function handleDataUpdate(data) {
  logger.debug('App', 'Data updated', data);
  renderAll();
  updateLastSyncTime();
}

/**
 * Handle data refresh
 */
function handleDataRefresh(data) {
  logger.info('App', 'Data refreshed', data);
  showToast('Data refreshed successfully', 'success');
  updateLastSyncTime();
}

/**
 * Handle data error
 */
function handleDataError(error) {
  logger.error('App', 'Data loading error', error);
  showToast('Failed to load data. Retrying...', 'error');
}

/**
 * Handle global search
 */
function handleGlobalSearch(event) {
  appState.filters.search = event.target.value.toLowerCase();
  logger.debug('App', `Global search: ${appState.filters.search}`);
  renderAll();
}

/**
 * Handle refresh button click
 */
async function handleRefresh() {
  logger.info('App', 'Manual refresh triggered');

  try {
    showLoading();
    await dataLoader.refresh();
    hideLoading();
  } catch (error) {
    logger.error('App', 'Refresh failed', error);
    hideLoading();
    showToast('Failed to refresh data', 'error');
  }
}

/**
 * Handle clear filters
 */
function handleClearFilters() {
  logger.debug('App', 'Clearing all filters');

  appState.filters.status.clear();
  appState.filters.priority.clear();
  appState.filters.goals.clear();
  appState.filters.search = '';
  appState.selectedGoal = null;

  elements.globalSearch.value = '';
  elements.memorySearch.value = '';

  renderAll();
}

/**
 * Handle memory search
 */
function handleMemorySearch(event) {
  const query = event.target.value.toLowerCase();
  logger.debug('App', `Memory search: ${query}`);
  renderMemories(query);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event) {
  // Focus search on '/' key
  if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    elements.globalSearch.focus();
    return;
  }

  // Refresh on Ctrl+R
  if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
    event.preventDefault();
    handleRefresh();
    return;
  }

  // Close modal on Escape
  if (event.key === 'Escape' && !elements.modalContainer.classList.contains('hidden')) {
    closeModal();
    return;
  }
}

/**
 * Render all sections
 */
function renderAll() {
  renderFilters();
  renderGoals();
  renderTasks();
  renderMemories();
}

/**
 * Render filter options
 */
function renderFilters() {
  const goals = dataLoader.getGoals();
  const tasks = dataLoader.getTasks();

  // Status filters
  const statuses = ['todo', 'in_progress', 'completed', 'cancelled'];
  elements.statusFilters.innerHTML = statuses.map(status => `
    <label class="filter-checkbox">
      <input type="checkbox" value="${status}" ${appState.filters.status.has(status) ? 'checked' : ''}>
      <span>${formatStatus(status)}</span>
    </label>
  `).join('');

  // Priority filters
  const priorities = ['low', 'medium', 'high'];
  elements.priorityFilters.innerHTML = priorities.map(priority => `
    <label class="filter-checkbox">
      <input type="checkbox" value="${priority}" ${appState.filters.priority.has(priority) ? 'checked' : ''}>
      <span>${formatPriority(priority)}</span>
    </label>
  `).join('');

  // Goal filters
  elements.goalFilters.innerHTML = goals.map(goal => `
    <label class="filter-checkbox">
      <input type="checkbox" value="${goal.id}" ${appState.filters.goals.has(goal.id) ? 'checked' : ''}>
      <span>${goal.title}</span>
    </label>
  `).join('');

  // Add filter event listeners
  elements.statusFilters.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        appState.filters.status.add(e.target.value);
      } else {
        appState.filters.status.delete(e.target.value);
      }
      renderTasks();
    });
  });

  elements.priorityFilters.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        appState.filters.priority.add(e.target.value);
      } else {
        appState.filters.priority.delete(e.target.value);
      }
      renderTasks();
    });
  });

  elements.goalFilters.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        appState.filters.goals.add(e.target.value);
      } else {
        appState.filters.goals.delete(e.target.value);
      }
      renderTasks();
    });
  });
}

/**
 * Render goals section
 */
function renderGoals() {
  const goals = dataLoader.getGoals();
  const tasks = dataLoader.getTasks();
  const filteredGoals = filterGoals(goals);

  elements.goalCount.textContent = `${filteredGoals.length} goal${filteredGoals.length !== 1 ? 's' : ''}`;

  if (filteredGoals.length === 0) {
    elements.goalCardsContainer.innerHTML = '';
    elements.goalsEmptyState.classList.remove('hidden');
    return;
  }

  elements.goalsEmptyState.classList.add('hidden');

  elements.goalCardsContainer.innerHTML = filteredGoals.map(goal =>
    renderGoalCard(goal, tasks)
  ).join('');

  // Setup goal card event listeners
  setupGoalCardListeners(
    elements.goalCardsContainer,
    handleGoalFilterClick,
    handleGoalViewClick
  );
}

/**
 * Render tasks section
 */
function renderTasks() {
  const tasks = dataLoader.getTasks();
  const goals = dataLoader.getGoals();
  const filteredTasks = filterTasks(tasks);

  elements.taskCount.textContent = `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`;

  if (filteredTasks.length === 0) {
    clearKanbanBoard();
    elements.tasksEmptyState.classList.remove('hidden');
    return;
  }

  elements.tasksEmptyState.classList.add('hidden');

  renderKanbanBoard(filteredTasks, goals);

  // Setup kanban event listeners
  setupKanbanListeners(elements.kanbanBoard, handleTaskViewClick);
}

/**
 * Render memories section
 */
function renderMemories(searchQuery = '') {
  const memories = dataLoader.getMemories();
  const filteredMemories = filterMemories(memories, searchQuery);

  elements.memoryCount.textContent = `${filteredMemories.length} memor${filteredMemories.length !== 1 ? 'ies' : 'y'}`;

  if (filteredMemories.length === 0) {
    elements.memoryList.innerHTML = '';
    elements.memoriesEmptyState.classList.remove('hidden');
    return;
  }

  elements.memoriesEmptyState.classList.add('hidden');

  elements.memoryList.innerHTML = filteredMemories.map(memory => `
    <div class="memory-item" data-id="${memory.id}">
      <div class="memory-header">
        <h4 class="memory-summary">${escapeHtml(memory.summary)}</h4>
        <span class="memory-date">${formatRelativeTime(memory.created_at)}</span>
      </div>
      <p class="memory-content">${escapeHtml(memory.content)}</p>
      ${memory.tags && memory.tags.length > 0 ? `
        <div class="memory-tags">
          ${memory.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Setup memory click listeners
  setupMemoryListeners();
}

/**
 * Filter goals based on search
 */
function filterGoals(goals) {
  if (!appState.filters.search) {
    return goals;
  }

  const query = appState.filters.search;
  return goals.filter(goal =>
    goal.title.toLowerCase().includes(query) ||
    goal.description.toLowerCase().includes(query)
  );
}

/**
 * Filter tasks based on filters
 */
function filterTasks(tasks) {
  return tasks.filter(task => {
    // Search filter
    if (appState.filters.search) {
      const query = appState.filters.search;
      const matchesSearch = task.title.toLowerCase().includes(query) ||
                          task.description.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (appState.filters.status.size > 0 && !appState.filters.status.has(task.status)) {
      return false;
    }

    // Priority filter
    if (appState.filters.priority.size > 0 && !appState.filters.priority.has(task.priority)) {
      return false;
    }

    // Goal filter
    if (appState.filters.goals.size > 0 && !appState.filters.goals.has(task.goal_id)) {
      return false;
    }

    return true;
  });
}

/**
 * Filter memories based on search
 */
function filterMemories(memories, searchQuery) {
  if (!searchQuery) {
    return memories;
  }

  const query = searchQuery.toLowerCase();
  return memories.filter(memory =>
    memory.summary.toLowerCase().includes(query) ||
    memory.content.toLowerCase().includes(query) ||
    (memory.tags && memory.tags.some(tag => tag.toLowerCase().includes(query)))
  );
}


/**
 * Render breadcrumb navigation
 */
function renderBreadcrumb() {
  if (!elements.modalBreadcrumb) return;

  if (appState.navigationPath.length === 0) {
    elements.modalBreadcrumb.classList.add('hidden');
    return;
  }

  elements.modalBreadcrumb.classList.remove('hidden');

  // Limit path display to MAX_PATH_DEPTH
  let displayPath = appState.navigationPath;
  let hasEllipsis = false;

  if (displayPath.length > MAX_PATH_DEPTH) {
    hasEllipsis = true;
    // Keep first item and last (MAX_PATH_DEPTH - 1) items
    displayPath = [
      displayPath[0],
      ...displayPath.slice(-(MAX_PATH_DEPTH - 1))
    ];
  }

  const breadcrumbHtml = displayPath.map((item, displayIndex) => {
    // Calculate actual index in navigationPath
    const actualIndex = hasEllipsis && displayIndex > 0
      ? appState.navigationPath.length - (MAX_PATH_DEPTH - 1) + (displayIndex - 1)
      : displayIndex;

    const isLast = actualIndex === appState.navigationPath.length - 1;
    const itemClass = isLast ? 'breadcrumb-item active' : 'breadcrumb-item';
    const separator = isLast ? '' : '<span class="breadcrumb-separator">/</span>';

    // Add ellipsis after first item if path is truncated
    const ellipsis = hasEllipsis && displayIndex === 0
      ? '<span class="breadcrumb-separator">...</span><span class="breadcrumb-separator">/</span>'
      : '';

    return `
      <span class="${itemClass}" data-nav-index="${actualIndex}" title="${escapeHtml(item.title)}">
        ${escapeHtml(truncateText(item.title, 30))}
      </span>
      ${separator}
      ${ellipsis}
    `;
  }).join('');

  elements.modalBreadcrumb.innerHTML = breadcrumbHtml;

  // Add click listeners to non-active items
  elements.modalBreadcrumb.querySelectorAll('.breadcrumb-item:not(.active)').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.navIndex);
      navigateToPathIndex(index);
    });
  });

  logger.debug('App', `Breadcrumb rendered with ${appState.navigationPath.length} items`);
}

/**
 * Navigate to specific index in navigation path
 * @param {number} index - Target index in navigationPath
 */
function navigateToPathIndex(index) {
  if (index < 0 || index >= appState.navigationPath.length) {
    logger.warn('App', `Invalid navigation index: ${index}`);
    return;
  }

  // Truncate path to target index (inclusive)
  appState.navigationPath = appState.navigationPath.slice(0, index + 1);

  // Navigate to target item
  const target = appState.navigationPath[appState.navigationPath.length - 1];

  logger.debug('App', `Navigating to ${target.type}: ${target.id}`);

  // Navigate without adding to path (addToPath = false)
  if (target.type === 'goal') {
    handleGoalViewClick(target.id, false);
  } else if (target.type === 'task') {
    handleTaskViewClick(target.id, false);
  } else if (target.type === 'memory') {
    handleMemoryViewClick(target.id, false);
  }
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Handle goal filter click
 */
function handleGoalFilterClick(goalId) {
  logger.debug('App', `Filtering tasks by goal: ${goalId}`);

  // Clear other goal filters and set only this one
  appState.filters.goals.clear();
  appState.filters.goals.add(goalId);

  renderTasks();

  // Scroll to tasks section
  elements.kanbanBoard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Handle goal view click
 * @param {string} goalId - Goal ID
 * @param {boolean} addToPath - Whether to add to navigation path
 */
function handleGoalViewClick(goalId, addToPath = true) {
  logger.debug('App', `Viewing goal: ${goalId}`);

  const goal = dataLoader.getGoalById(goalId);
  if (!goal) {
    showToast('Goal not found', 'error');
    return;
  }

  // Add to navigation path
  if (addToPath) {
    appState.navigationPath.push({
      type: 'goal',
      id: goalId,
      title: goal.title
    });
  }

  // Render modal content
  const tasks = dataLoader.getTasksByGoalId(goalId);
  const modalContent = renderGoalDetailModal(goal, tasks);

  elements.modalBody.innerHTML = modalContent;
  elements.modalContainer.classList.remove('hidden');

  // Render breadcrumb
  renderBreadcrumb();

  // Add click listeners to task list items in the modal
  setupModalTaskListeners();
}

/**
 * Handle task view click
 * @param {string} taskId - Task ID
 * @param {boolean} addToPath - Whether to add to navigation path
 */
function handleTaskViewClick(taskId, addToPath = true) {
  logger.debug('App', `Viewing task: ${taskId}`);

  const task = dataLoader.getTaskById(taskId);
  if (!task) {
    showToast('Task not found', 'error');
    return;
  }

  const goal = dataLoader.getGoalById(task.goal_id);
  if (!goal) {
    showToast('Associated goal not found', 'error');
    return;
  }

  // Smart path management
  if (addToPath) {
    // Find if this task's goal is already in the path
    const goalIndex = appState.navigationPath.findIndex(
      item => item.type === 'goal' && item.id === task.goal_id
    );

    if (goalIndex === -1) {
      // Goal not in path - reset path with Goal + Task
      appState.navigationPath = [
        { type: 'goal', id: task.goal_id, title: goal.title },
        { type: 'task', id: taskId, title: task.title }
      ];
    } else if (goalIndex === appState.navigationPath.length - 1) {
      // Goal is last item - append task
      appState.navigationPath.push({
        type: 'task',
        id: taskId,
        title: task.title
      });
    } else {
      // Goal exists but not last - truncate to goal and append task
      appState.navigationPath = appState.navigationPath.slice(0, goalIndex + 1);
      appState.navigationPath.push({
        type: 'task',
        id: taskId,
        title: task.title
      });
    }
  }

  // Render modal content
  const allTasks = dataLoader.getTasks();
  const modalContent = renderTaskDetailModal(task, goal, allTasks);

  elements.modalBody.innerHTML = modalContent;
  elements.modalContainer.classList.remove('hidden');

  // Render breadcrumb
  renderBreadcrumb();

  // Add click listeners for dependency items in the modal
  setupModalDependencyListeners();
}

/**
 * Setup click listeners for task list items in modal
 */
function setupModalTaskListeners() {
  const taskItems = elements.modalBody.querySelectorAll('.task-list-item');
  taskItems.forEach(item => {
    item.addEventListener('click', () => {
      const taskId = item.dataset.taskId;
      if (taskId) {
        handleTaskViewClick(taskId);
      }
    });
  });
}

/**
 * Setup click listeners for dependency items in modal
 */
function setupModalDependencyListeners() {
  const depItems = elements.modalBody.querySelectorAll('.dependency-item');
  depItems.forEach(item => {
    item.addEventListener('click', () => {
      const taskId = item.dataset.taskId;
      if (taskId) {
        handleTaskViewClick(taskId);
      }
    });
  });
}

/**
 * Setup click listeners for memory items
 */
function setupMemoryListeners() {
  const memoryItems = elements.memoryList.querySelectorAll('.memory-item');
  memoryItems.forEach(item => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      const memoryId = item.dataset.id;
      if (memoryId) {
        handleMemoryViewClick(memoryId);
      }
    });
  });
}

/**
 * Handle memory view click
 * @param {string} memoryId - Memory ID
 * @param {boolean} addToPath - Whether to add to navigation path
 */
function handleMemoryViewClick(memoryId, addToPath = true) {
  logger.debug('App', `Viewing memory: ${memoryId}`);

  const memory = dataLoader.getMemoryById(memoryId);
  if (!memory) {
    showToast('Memory not found', 'error');
    return;
  }

  // Add to navigation path (only if clicked from Task modal)
  if (addToPath) {
    appState.navigationPath.push({
      type: 'memory',
      id: memoryId,
      title: memory.summary
    });
  }

  // Render modal content
  const modalContent = renderMemoryDetailModal(memory);
  elements.modalBody.innerHTML = modalContent;
  elements.modalContainer.classList.remove('hidden');

  // Render breadcrumb
  renderBreadcrumb();
}

/**
 * Render memory detail modal
 */
function renderMemoryDetailModal(memory) {
  return `
    <div class="memory-detail-modal">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">${escapeHtml(memory.summary)}</h2>
      </div>

      <div class="modal-body">
        <section class="modal-section">
          <h3 class="modal-section-title">Content</h3>
          <p class="modal-description" style="white-space: pre-wrap;">${escapeHtml(memory.content)}</p>
        </section>

        ${memory.context_id ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Context</h3>
            <p class="modal-note">Context ID: <code>${escapeHtml(memory.context_id)}</code></p>
          </section>
        ` : ''}

        ${memory.tags && memory.tags.length > 0 ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Tags</h3>
            <div class="memory-tags">
              ${memory.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ')}
            </div>
          </section>
        ` : ''}

        <section class="modal-section">
          <h3 class="modal-section-title">Metadata</h3>
          <dl class="metadata-list">
            <dt>Memory ID:</dt>
            <dd><code>${memory.id}</code></dd>

            <dt>Created:</dt>
            <dd>${formatDate(memory.created_at)} (${formatRelativeTime(memory.created_at)})</dd>

            ${memory.updated_at ? `
              <dt>Last Updated:</dt>
              <dd>${formatDate(memory.updated_at)} (${formatRelativeTime(memory.updated_at)})</dd>
            ` : ''}
          </dl>
        </section>
      </div>
    </div>
  `;
}

/**
 * Format date string
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    logger.error('App', 'Failed to format date', error);
    return dateString;
  }
}

/**
 * Update last sync time display
 */
function updateLastSyncTime() {
  const lastFetchTime = dataLoader.getLastFetchTime();

  if (!lastFetchTime) {
    elements.lastUpdate.textContent = 'Never synced';
    return;
  }

  elements.lastUpdate.textContent = `Last synced ${formatRelativeTime(lastFetchTime)}`;
}

/**
 * Show loading indicator
 */
function showLoading() {
  appState.isLoading = true;
  elements.loadingIndicator.classList.remove('hidden');
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  appState.isLoading = false;
  elements.loadingIndicator.classList.add('hidden');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Close modal and clean up all state
 */
function closeModal() {
  logger.debug('App', 'Closing modal');

  // Hide modal container
  elements.modalContainer.classList.add('hidden');

  // Clear modal content and navigation path
  elements.modalBody.innerHTML = '';
  appState.navigationPath = [];

  // Hide breadcrumb
  if (elements.modalBreadcrumb) {
    elements.modalBreadcrumb.classList.add('hidden');
  }

  logger.debug('App', 'Modal closed and navigation path cleared');
}


/**
 * Format status for display
 */
function formatStatus(status) {
  const statusMap = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
}

/**
 * Format priority for display
 */
function formatPriority(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}


// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for testing
export { appState, renderAll, showToast };
