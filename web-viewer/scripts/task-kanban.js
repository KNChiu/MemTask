/**
 * Task Kanban Module
 *
 * Handles rendering and interactions for Task Kanban board:
 * - Render task cards in respective columns
 * - Draw dependency arrows between tasks
 * - Handle task card interactions
 * - Update column counts
 */

import { logger } from './logger.js';
import { formatRelativeTime, escapeHtml, truncateText, formatAbsoluteDate, calculateDueDateStatus, getTagColor } from './utils.js';
import { getStatusClass, getPriorityClass, formatPriority } from './goal-renderer.js';

/**
 * Render kanban board with tasks
 * @param {Array} tasks - Array of task objects
 * @param {Array} goals - Array of goal objects (for goal names)
 */
export function renderKanban(tasks, goals = []) {
  logger.debug('TaskKanban', `Rendering ${tasks.length} tasks`);

  // Group tasks by status
  const tasksByStatus = {
    'todo': [],
    'in_progress': [],
    'completed': [],
    'cancelled': []
  };

  tasks.forEach(task => {
    if (tasksByStatus[task.status]) {
      tasksByStatus[task.status].push(task);
    }
  });

  // Render each column
  renderColumn('todo', tasksByStatus.todo, goals);
  renderColumn('in_progress', tasksByStatus.in_progress, goals);
  renderColumn('completed', tasksByStatus.completed, goals);
  renderColumn('cancelled', tasksByStatus.cancelled, goals);

  // Update column counts
  updateColumnCounts(tasksByStatus);

  // Draw dependency arrows
  setTimeout(() => drawDependencyArrows(tasks), 100);
}

/**
 * Render a kanban column
 * @param {string} status - Column status
 * @param {Array} tasks - Tasks for this column
 * @param {Array} goals - All goals
 */
function renderColumn(status, tasks, goals) {
  const columnId = status === 'in_progress' ? 'in-progress-column' : `${status}-column`;
  const column = document.getElementById(columnId);

  if (!column) {
    logger.error('TaskKanban', `Column element not found: ${columnId}`);
    return;
  }

  if (tasks.length === 0) {
    column.innerHTML = '<div class="kanban-empty">No tasks</div>';
    return;
  }

  column.innerHTML = tasks.map(task => renderTaskCard(task, goals)).join('');
}

/**
 * Render a single task card
 * @param {Object} task - Task object
 * @param {Array} goals - All goals (for goal name lookup)
 * @returns {string} HTML string
 */
export function renderTaskCard(task, goals = []) {
  const goal = goals.find(g => g.id === task.goal_id);
  const goalName = goal ? goal.title : 'Unknown Goal';

  const priorityClass = getPriorityClass(task.priority);
  const hasDependencies = task.depends_on && task.depends_on.length > 0;

  return `
    <div class="task-card"
         data-task-id="${task.id}"
         data-status="${task.status}"
         data-goal-id="${task.goal_id}">

      <div class="task-card-header">
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        <span class="badge badge-priority ${priorityClass}">${formatPriority(task.priority)}</span>
      </div>

      <p class="task-description">${escapeHtml(truncateText(task.description, 120))}</p>

      <div class="task-goal-link">
        <span class="goal-icon">🎯</span>
        <span class="goal-name">${escapeHtml(goalName)}</span>
      </div>

      ${hasDependencies ? `
        <div class="task-dependencies">
          <span class="dependency-icon">⛓</span>
          <span class="dependency-count">${task.depends_on.length} dependency${task.depends_on.length > 1 ? 'ies' : ''}</span>
        </div>
      ` : ''}

      ${task.due_date ? renderDueDate(task.due_date, task.status) : ''}

      ${task.tags && task.tags.length > 0 ? `
        <div class="task-tags">
          ${task.tags.map(tag => `
            <span class="tag tag-sm" style="background-color: ${getTagColor(tag)}">${escapeHtml(tag)}</span>
          `).join('')}
        </div>
      ` : ''}

      <div class="task-meta">
        <span class="task-date">${formatRelativeTime(task.created_at)}</span>
        <button class="btn-link view-task-btn" data-task-id="${task.id}">
          View Details
        </button>
      </div>
    </div>
  `;
}

/**
 * Render task detail modal
 * @param {Object} task - Task object
 * @param {Object} goal - Associated goal
 * @param {Array} allTasks - All tasks (for dependency lookup)
 * @returns {string} HTML string
 */
export function renderTaskDetailModal(task, goal, allTasks = []) {
  const priorityClass = getPriorityClass(task.priority);
  const statusClass = getStatusClass(task.status);

  const dependencyTasks = task.depends_on
    ? task.depends_on.map(depId => allTasks.find(t => t.id === depId)).filter(Boolean)
    : [];

  return `
    <div class="task-detail-modal">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">${escapeHtml(task.title)}</h2>
        <div class="modal-badges">
          <span class="badge badge-status ${statusClass}">${formatStatus(task.status)}</span>
          <span class="badge badge-priority ${priorityClass}">${formatPriority(task.priority)}</span>
        </div>
      </div>

      <div class="modal-body">
        <section class="modal-section">
          <h3 class="modal-section-title">Description</h3>
          <p class="modal-description">${escapeHtml(task.description)}</p>
        </section>

        ${goal ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Goal</h3>
            <div class="goal-link-card">
              <div class="goal-link-header">
                <span class="goal-icon">🎯</span>
                <h4 class="goal-link-title">${escapeHtml(goal.title)}</h4>
                <span class="badge badge-status ${getStatusClass(goal.status)}">${formatGoalStatus(goal.status)}</span>
              </div>
              <p class="goal-link-description">${escapeHtml(truncateText(goal.description, 150))}</p>
            </div>
          </section>
        ` : ''}

        ${dependencyTasks.length > 0 ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Dependencies (${dependencyTasks.length})</h3>
            <div class="dependency-list">
              ${dependencyTasks.map(depTask => `
                <div class="dependency-item" data-task-id="${depTask.id}">
                  <span class="task-status-icon ${getStatusClass(depTask.status)}">
                    ${getStatusIcon(depTask.status)}
                  </span>
                  <span class="dependency-task-title">${escapeHtml(depTask.title)}</span>
                  <span class="badge badge-status ${getStatusClass(depTask.status)}">${formatStatus(depTask.status)}</span>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        ${task.progress_note ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Progress Note</h3>
            <p class="modal-note">${escapeHtml(task.progress_note)}</p>
          </section>
        ` : ''}

        ${task.linked_memories && task.linked_memories.length > 0 ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Linked Memories (${task.linked_memories.length})</h3>
            <div class="linked-memories-list">
              ${task.linked_memories.map(memId => `
                <div class="memory-chip" data-memory-id="${memId}">
                  <span class="memory-icon">💭</span>
                  <span class="memory-id">${memId}</span>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <section class="modal-section">
          <h3 class="modal-section-title">Metadata</h3>
          <dl class="metadata-list">
            <dt>Task ID:</dt>
            <dd><code>${task.id}</code></dd>

            <dt>Goal ID:</dt>
            <dd><code>${task.goal_id}</code></dd>

            <dt>Status:</dt>
            <dd>${formatStatus(task.status)}</dd>

            <dt>Priority:</dt>
            <dd>${formatPriority(task.priority)}</dd>

            <dt>Created:</dt>
            <dd>${formatDate(task.created_at)} (${formatRelativeTime(task.created_at)})</dd>

            ${task.updated_at ? `
              <dt>Last Updated:</dt>
              <dd>${formatDate(task.updated_at)} (${formatRelativeTime(task.updated_at)})</dd>
            ` : ''}

            ${task.due_date ? `
              <dt>Due Date:</dt>
              <dd class="${isOverdue(task.due_date, task.status) ? 'text-error' : ''}">
                ${formatDate(task.due_date)}
                ${isOverdue(task.due_date, task.status) ? ' (Overdue)' : ''}
              </dd>
            ` : ''}

            ${task.tags && task.tags.length > 0 ? `
              <dt>Tags:</dt>
              <dd>
                ${task.tags.map(tag => `<span class="tag" style="background-color: ${getTagColor(tag)}">${escapeHtml(tag)}</span>`).join(' ')}
              </dd>
            ` : ''}
          </dl>
        </section>
      </div>
    </div>
  `;
}

/**
 * Update column counts
 * @param {Object} tasksByStatus - Tasks grouped by status
 */
function updateColumnCounts(tasksByStatus) {
  document.getElementById('todo-count').textContent = tasksByStatus.todo.length;
  document.getElementById('in-progress-count').textContent = tasksByStatus.in_progress.length;
  document.getElementById('completed-count').textContent = tasksByStatus.completed.length;
  document.getElementById('cancelled-count').textContent = tasksByStatus.cancelled.length;
}

/**
 * Draw dependency arrows between tasks
 * @param {Array} tasks - All tasks
 */
function drawDependencyArrows(tasks) {
  const svg = document.getElementById('dependency-svg');
  if (!svg) return;

  // Clear existing arrows
  svg.querySelectorAll('line').forEach(line => line.remove());

  const tasksWithDeps = tasks.filter(t => t.depends_on && t.depends_on.length > 0);

  tasksWithDeps.forEach(task => {
    const taskCard = document.querySelector(`[data-task-id="${task.id}"]`);
    if (!taskCard) return;

    task.depends_on.forEach(depId => {
      const depCard = document.querySelector(`[data-task-id="${depId}"]`);
      if (!depCard) return;

      drawArrow(svg, depCard, taskCard);
    });
  });
}

/**
 * Draw arrow between two task cards
 * @param {SVGElement} svg - SVG container
 * @param {HTMLElement} fromCard - Source card
 * @param {HTMLElement} toCard - Target card
 */
function drawArrow(svg, fromCard, toCard) {
  const fromRect = fromCard.getBoundingClientRect();
  const toRect = toCard.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();

  // Calculate arrow coordinates (from right side of source to left side of target)
  const x1 = fromRect.right - svgRect.left;
  const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
  const x2 = toRect.left - svgRect.left;
  const y2 = toRect.top + toRect.height / 2 - svgRect.top;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', 'var(--color-dependency, #999)');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('marker-end', 'url(#arrowhead)');

  svg.appendChild(line);
}

/**
 * Set up kanban event listeners
 * @param {HTMLElement} kanbanBoard - Kanban board container
 * @param {Function} onTaskClick - Callback for task card click
 */
export function setupKanbanListeners(kanbanBoard, onTaskClick) {
  kanbanBoard.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('.view-task-btn');
    if (viewBtn) {
      const taskId = viewBtn.dataset.taskId;
      logger.debug('TaskKanban', `View task details: ${taskId}`);
      onTaskClick(taskId);
      return;
    }

    // Click on task card itself (not button)
    const taskCard = event.target.closest('.task-card');
    if (taskCard && !event.target.closest('button')) {
      const taskId = taskCard.dataset.taskId;
      logger.debug('TaskKanban', `Task card clicked: ${taskId}`);
      onTaskClick(taskId);
    }
  });
}

/**
 * Render due date with rich status
 */
function renderDueDate(dueDate, taskStatus) {
  if (!dueDate || taskStatus === 'completed' || taskStatus === 'cancelled') {
    return '';
  }

  const dueDateStatus = calculateDueDateStatus(dueDate);
  const statusClassMap = {
    'overdue': 'overdue',
    'today': 'due-today',
    'upcoming': 'due-upcoming',
    'future': 'due-future'
  };

  const statusClass = statusClassMap[dueDateStatus.status] || '';

  return `
    <div class="task-due-date ${statusClass}">
      <span class="due-icon">📅</span>
      <span class="due-text">${dueDateStatus.text}</span>
    </div>
  `;
}

/**
 * Get status icon
 */
function getStatusIcon(status) {
  const iconMap = {
    'todo': '○',
    'in_progress': '◐',
    'completed': '●',
    'cancelled': '✕'
  };
  return iconMap[status] || '○';
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
 * Format goal status for display
 */
function formatGoalStatus(status) {
  const statusMap = {
    'planning': 'Planning',
    'active': 'Active',
    'completed': 'Completed',
    'on_hold': 'On Hold',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
}

/**
 * Format date string with time for modal display
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
    logger.error('TaskKanban', 'Failed to format date', error);
    return dateString;
  }
}

/**
 * Check if due date is overdue
 */
function isOverdue(dueDate, status) {
  if (!dueDate || status === 'completed' || status === 'cancelled') {
    return false;
  }

  try {
    const due = new Date(dueDate);
    const now = new Date();
    return due < now;
  } catch (error) {
    return false;
  }
}


/**
 * Clear kanban board
 */
export function clearKanban() {
  ['todo-column', 'in-progress-column', 'completed-column', 'cancelled-column'].forEach(id => {
    const column = document.getElementById(id);
    if (column) {
      column.innerHTML = '<div class="kanban-empty">No tasks</div>';
    }
  });

  // Clear dependency arrows
  const svg = document.getElementById('dependency-svg');
  if (svg) {
    svg.querySelectorAll('line').forEach(line => line.remove());
  }

  // Reset counts
  updateColumnCounts({
    todo: [],
    in_progress: [],
    completed: [],
    cancelled: []
  });
}
