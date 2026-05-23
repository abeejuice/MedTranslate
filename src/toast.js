let container;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'default', duration = 3000) {
  const c = getContainer();
  const toast = document.createElement('div');
  toast.className = `toast${type !== 'default' ? ` toast-${type}` : ''}`;
  toast.textContent = message;
  c.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
