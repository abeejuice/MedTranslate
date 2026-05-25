// Escape HTML to prevent XSS when interpolating user data into innerHTML
export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function showBottomSheet({ title, message, actions }) {
  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';

  const titleEl = document.createElement('div');
  titleEl.className = 'bottom-sheet__title';
  titleEl.textContent = title;
  sheet.appendChild(titleEl);

  if (message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'bottom-sheet__message';
    msgEl.textContent = message;
    sheet.appendChild(msgEl);
  }

  const btnGroup = document.createElement('div');
  btnGroup.className = 'bottom-sheet__actions';

  actions.forEach(({ label, style, onClick }) => {
    const btn = document.createElement('button');
    btn.className = `bottom-sheet__btn bottom-sheet__btn--${style || 'default'}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      overlay.remove();
      if (onClick) onClick();
    });
    btnGroup.appendChild(btn);
  });

  sheet.appendChild(btnGroup);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });

  requestAnimationFrame(() => overlay.classList.add('bottom-sheet-overlay--visible'));

  return () => overlay.remove();
}
