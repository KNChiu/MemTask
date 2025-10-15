/**
 * Goal Renderer Module
 *
 * Handles rendering and interactions for Goal cards:
 * - Render goal cards with status/priority badges
 * - Display linked tasks count and progress
 * - Handle goal card interactions (click to filter)
 * - Show goal details in modal
 */

import { logger } from './logger.js';
import { formatRelativeTime, escapeHtml } from './utils.js';

/**
 * Render a single goal card
 * @param {Object} goal - Goal object
 * @param {Array} tasks - All tasks (for counting linked tasks)
 * @returns {string} HTML string for goal card
 */
export function renderGoalCard(goal, tasks = []) {
  const linkedTasks = tasks.filter(t => t.goal_id === goal.id);
  const completedTasks = linkedTasks.filter(t => t.status === 'completed').length;
  const totalTasks = linkedTasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statusClass = getStatusClass(goal.status);
  const priorityClass = getPriorityClass(goal.priority);

  return `
    <div class="goal-card" data-goal-id="${goal.id}" data-status="${goal.status}">
      <div class="goal-card-header">
        <h3 class="goal-title">${escapeHtml(goal.title)}</h3>
        <div class="goal-badges">
          <span class="badge badge-status ${statusClass}">${formatStatus(goal.status)}</span>
          <span class="badge badge-priority ${priorityClass}">${formatPriority(goal.priority)}</span>
        </div>
      </div>

      <p class="goal-description">${escapeHtml(goal.description)}</p>

      ${goal.success_criteria && goal.success_criteria.length > 0 ? `
        <div class="goal-success-criteria">
          <h4 class="criteria-title">Success Criteria:</h4>
          <ul class="criteria-list">
            ${goal.success_criteria.map(criterion => `
              <li>${escapeHtml(criterion)}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="goal-progress">
        <div class="progress-header">
          <span class="progress-label">Tasks Progress</span>
          <span class="progress-value">${completedTasks}/${totalTasks} (${progress}%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="goal-meta">
        <div class="goal-meta-item">
          <span class="meta-label">Created:</span>
          <span class="meta-value">${formatRelativeTime(goal.created_at)}</span>
        </div>
        ${goal.target_date ? `
          <div class="goal-meta-item">
            <span class="meta-label">Target:</span>
            <span class="meta-value ${isOverdue(goal.target_date, goal.status) ? 'text-error' : ''}">
              ${formatDate(goal.target_date)}
            </span>
          </div>
        ` : ''}
        ${goal.updated_at ? `
          <div class="goal-meta-item">
            <span class="meta-label">Updated:</span>
            <span class="meta-value">${formatRelativeTime(goal.updated_at)}</span>
          </div>
        ` : ''}
      </div>

      ${goal.tags && goal.tags.length > 0 ? `
        <div class="goal-tags">
          ${goal.tags.map(tag => `
            <span class="tag">${escapeHtml(tag)}</span>
          `).join('')}
        </div>
      ` : ''}

      <div class="goal-actions">
        <button class="btn btn-sm btn-outline view-goal-btn" data-goal-id="${goal.id}">
          View Details
        </button>
        <button class="btn btn-sm btn-primary filter-tasks-btn" data-goal-id="${goal.id}">
          Show Tasks (${totalTasks})
        </button>
      </div>
    </div>
  `;
}

/**
 * Render goal detail modal
 * @param {Object} goal - Goal object
 * @param {Array} tasks - Linked tasks
 * @returns {string} HTML string for modal content
 */
export function renderGoalDetailModal(goal, tasks = []) {
  const linkedTasks = tasks.filter(t => t.goal_id === goal.id);
  const statusClass = getStatusClass(goal.status);
  const priorityClass = getPriorityClass(goal.priority);

  return `
    <div class="goal-detail-modal">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">${escapeHtml(goal.title)}</h2>
        <div class="modal-badges">
          <span class="badge badge-status ${statusClass}">${formatStatus(goal.status)}</span>
          <span class="badge badge-priority ${priorityClass}">${formatPriority(goal.priority)}</span>
        </div>
      </div>

      <div class="modal-body">
        <section class="modal-section">
          <h3 class="modal-section-title">Description</h3>
          <p class="modal-description">${escapeHtml(goal.description)}</p>
        </section>

        ${goal.success_criteria && goal.success_criteria.length > 0 ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Success Criteria</h3>
            <ul class="criteria-list">
              ${goal.success_criteria.map(criterion => `
                <li>${escapeHtml(criterion)}</li>
              `).join('')}
            </ul>
          </section>
        ` : ''}

        ${goal.progress_note ? `
          <section class="modal-section">
            <h3 class="modal-section-title">Progress Note</h3>
            <p class="modal-note">${escapeHtml(goal.progress_note)}</p>
          </section>
        ` : ''}

        <section class="modal-section">
          <h3 class="modal-section-title">Linked Tasks (${linkedTasks.length})</h3>
          ${linkedTasks.length > 0 ? `
            <div class="modal-task-list">
              ${linkedTasks.map(task => renderTaskListItem(task)).join('')}
            </div>
          ` : `
            <p class="text-muted">No tasks linked to this goal yet.</p>
          `}
        </section>

        <section class="modal-section">
          <h3 class="modal-section-title">Metadata</h3>
          <dl class="metadata-list">
            <dt>Goal ID:</dt>
            <dd><code>${goal.id}</code></dd>

            <dt>Status:</dt>
            <dd>${formatStatus(goal.status)}</dd>

            <dt>Priority:</dt>
            <dd>${formatPriority(goal.priority)}</dd>

            <dt>Created:</dt>
            <dd>${formatDate(goal.created_at)} (${formatRelativeTime(goal.created_at)})</dd>

            ${goal.updated_at ? `
              <dt>Last Updated:</dt>
              <dd>${formatDate(goal.updated_at)} (${formatRelativeTime(goal.updated_at)})</dd>
            ` : ''}

            ${goal.target_date ? `
              <dt>Target Date:</dt>
              <dd class="${isOverdue(goal.target_date, goal.status) ? 'text-error' : ''}">
                ${formatDate(goal.target_date)}
                ${isOverdue(goal.target_date, goal.status) ? ' (Overdue)' : ''}
              </dd>
            ` : ''}

            ${goal.tags && goal.tags.length > 0 ? `
              <dt>Tags:</dt>
              <dd>
                ${goal.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ')}
              </dd>
            ` : ''}
          </dl>
        </section>
      </div>
    </div>
  `;
}

/**
 * Render task list item for modal
 * @param {Object} task - Task object
 * @returns {string} HTML string
 */
function renderTaskListItem(task) {
  const statusClass = getStatusClass(task.status);

  return `
    <div class="task-list-item" data-task-id="${task.id}">
      <div class="task-list-item-header">
        <span class="task-status-icon ${statusClass}">
          ${getStatusIcon(task.status)}
        </span>
        <h4 class="task-list-item-title">${escapeHtml(task.title)}</h4>
        <span class="badge badge-priority ${getPriorityClass(task.priority)}">${formatPriority(task.priority)}</span>
      </div>
      ${task.description ? `
        <p class="task-list-item-description">${escapeHtml(truncate(task.description, 100))}</p>
      ` : ''}
    </div>
  `;
}

/**
 * Get status CSS class
 */
function getStatusClass(status) {
  const classMap = {
    'planning': 'status-planning',
    'active': 'status-active',
    'completed': 'status-completed',
    'on_hold': 'status-on-hold',
    'cancelled': 'status-cancelled',
    'todo': 'status-todo',
    'in_progress': 'status-in-progress'
  };
  return classMap[status] || '';
}

/**
 * Get priority CSS class
 */
function getPriorityClass(priority) {
  const classMap = {
    'low': 'priority-low',
    'medium': 'priority-medium',
    'high': 'priority-high'
  };
  return classMap[priority] || '';
}

/**
 * Get status icon
 */
function getStatusIcon(status) {
  const iconMap = {
    'todo': '○',
    'in_progress': '◐',
    'completed': '●',
    'cancelled': '✕',
    'planning': '◇',
    'active': '◆',
    'on_hold': '⏸'
  };
  return iconMap[status] || '○';
}

/**
 * Format status for display
 */
function formatStatus(status) {
  const statusMap = {
    'planning': 'Planning',
    'active': 'Active',
    'completed': 'Completed',
    'on_hold': 'On Hold',
    'cancelled': 'Cancelled',
    'todo': 'To Do',
    'in_progress': 'In Progress'
  };
  return statusMap[status] || status;
}

/**
 * Format priority for display
 */
function formatPriority(priority) {
  return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium';
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
      day: 'numeric'
    });
  } catch (error) {
    logger.error('GoalRenderer', 'Failed to format date', error);
    return dateString;
  }
}

/**
 * Check if target date is overdue
 */
function isOverdue(targetDate, status) {
  if (!targetDate || status === 'completed' || status === 'cancelled') {
    return false;
  }

  try {
    const target = new Date(targetDate);
    const now = new Date();
    return target < now;
  } catch (error) {
    return false;
  }
}

/**
 * Truncate text to specified length
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Set up goal card event listeners
 * @param {HTMLElement} container - Container element
 * @param {Function} onFilterClick - Callback for filter button click
 * @param {Function} onViewClick - Callback for view details button click
 */
export function setupGoalCardListeners(container, onFilterClick, onViewClick) {
  // Filter tasks by goal
  container.addEventListener('click', (event) => {
    const filterBtn = event.target.closest('.filter-tasks-btn');
    if (filterBtn) {
      const goalId = filterBtn.dataset.goalId;
      logger.debug('GoalRenderer', `Filter tasks by goal: ${goalId}`);
      onFilterClick(goalId);
      return;
    }

    // View goal details
    const viewBtn = event.target.closest('.view-goal-btn');
    if (viewBtn) {
      const goalId = viewBtn.dataset.goalId;
      logger.debug('GoalRenderer', `View goal details: ${goalId}`);
      onViewClick(goalId);
      return;
    }
  });
}

export { getStatusClass, getPriorityClass, formatStatus, formatPriority };
