/**
 * Utility Functions
 * Date formatting, ID validation, DOM helpers, etc.
 */

/**
 * Format ISO date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffYear > 0) return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
  if (diffMonth > 0) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  if (diffWeek > 0) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Format ISO date to absolute date (e.g., "Oct 13, 2025")
 */
export function formatAbsoluteDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Calculate days until/overdue for due date
 */
export function calculateDueDateStatus(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'overdue', days: Math.abs(diffDays), text: `OVERDUE by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}` };
  } else if (diffDays === 0) {
    return { status: 'today', days: 0, text: 'Due today' };
  } else if (diffDays <= 3) {
    return { status: 'upcoming', days: diffDays, text: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}` };
  } else {
    return { status: 'future', days: diffDays, text: `Due ${formatAbsoluteDate(dueDate)}` };
  }
}

/**
 * Validate ID format
 */
export function validateId(id, type) {
  if (!id || typeof id !== 'string') return false;

  switch (type) {
    case 'goal':
      return /^goal-\d+$/.test(id);
    case 'task':
      return /^\d+$/.test(id);
    case 'memory':
      return /^mem-.+$/.test(id) || /^[a-f0-9-]{36}$/.test(id);
    default:
      return false;
  }
}

/**
 * Sanitize text content (prevent XSS)
 */
export function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Generate tag color from tag name (hash-based)
 */
export function getTagColor(tag) {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 85%)`;
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create DOM element with attributes and children
 */
export function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = dataValue;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = createElement('div', { className: `toast toast-${type}` }, [
    createElement('div', { className: 'toast-icon' }, [getToastIcon(type)]),
    createElement('div', { className: 'toast-content' }, [
      createElement('div', { className: 'toast-message' }, [message])
    ]),
    createElement('button', {
      className: 'toast-close',
      'aria-label': 'Close notification',
      onClick: () => toast.remove()
    }, ['×'])
  ]);

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, duration);
}

function getToastIcon(type) {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    default: return 'ℹ';
  }
}

/**
 * Show/hide loading indicator
 */
export function setLoading(show) {
  const indicator = document.getElementById('loading-indicator');
  if (indicator) {
    indicator.classList.toggle('hidden', !show);
  }
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(completed, total) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Group array by key
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = typeof key === 'function' ? key(item) : item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Deep equality comparison
 */
export function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
