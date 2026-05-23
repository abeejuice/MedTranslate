// Escape HTML to prevent XSS when interpolating user data into innerHTML
export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
