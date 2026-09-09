/**
 * HAV-186 — Toast Notification Utility & Styling
 * HAV-188 — Async Action State Notification Triggers
 */

let toastContainer = null;
const MAX_TOASTS = 3; // prevent screen flood

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(message, type = 'success') {
  const container = getToastContainer();

  // Remove oldest toast if we hit max
  if (container.children.length >= MAX_TOASTS) {
    container.firstChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = type === 'success' ? '✓' : '!';

  const text = document.createElement('span');
  text.className = 'toast__message';
  text.textContent = message;

  const dismiss = document.createElement('button');
  dismiss.className = 'toast__dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '×';

  toast.append(icon, text, dismiss);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  const timeoutId = setTimeout(() => dismissToast(toast), 3500);
  dismiss.addEventListener('click', () => {
    clearTimeout(timeoutId);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  toast.classList.remove('toast--visible');
  toast.classList.add('toast--leaving');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

window.showToast = showToast;
