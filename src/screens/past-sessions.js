import { registerScreen, navigate } from '../router.js';
import { getAllSessions, deleteSession } from '../db.js';
import { showToast } from '../toast.js';
import { TEMPLATES } from '../data/templates.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'long' });
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

function getTemplateIcon(templateId) {
  if (!templateId) return '🏥';
  const tpl = TEMPLATES.find(t => t.id === templateId);
  return tpl ? tpl.icon : '🏥';
}

// ── Build a single session list item ─────────────────────────────────────────

function buildSessionItem(session) {
  const item = document.createElement('div');
  item.className = 'session-item';
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');

  const iconEl = document.createElement('div');
  iconEl.className = 'session-item__icon';
  iconEl.textContent = getTemplateIcon(session.templateId);

  const body = document.createElement('div');
  body.className = 'session-item__body';

  const title = document.createElement('div');
  title.className = 'session-item__title';
  title.textContent = session.patientLabel || 'Unknown Patient';

  const meta = document.createElement('div');
  meta.className = 'session-item__meta';
  const langPart = session.languageLabel ? `${session.languageLabel} · ` : '';
  meta.textContent = `${langPart}${session.templateLabel || ''}`;

  const dateMeta = document.createElement('div');
  dateMeta.className = 'session-item__meta';
  dateMeta.textContent = formatDate(session.startedAt);

  body.appendChild(title);
  body.appendChild(meta);
  body.appendChild(dateMeta);

  item.appendChild(iconEl);
  item.appendChild(body);

  return item;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

function mount(el) {
  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'app-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'app-header__back';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.textContent = '←';
  backBtn.addEventListener('click', () => history.back());

  const headerTitle = document.createElement('div');
  headerTitle.className = 'app-header__title';
  headerTitle.textContent = 'Past Sessions';

  header.appendChild(backBtn);
  header.appendChild(headerTitle);
  el.appendChild(header);

  // ── Content ───────────────────────────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'screen-content';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  content.appendChild(spinner);
  el.appendChild(content);

  // ── Load sessions ─────────────────────────────────────────────────────────
  getAllSessions().then(sessions => {
    // Remove spinner
    spinner.remove();

    if (!sessions || sessions.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';

      const emptyIcon = document.createElement('div');
      emptyIcon.className = 'empty-state__icon';
      emptyIcon.textContent = '📭';

      const emptyTitle = document.createElement('div');
      emptyTitle.className = 'empty-state__title';
      emptyTitle.textContent = 'No past sessions';

      const emptyBody = document.createElement('div');
      emptyBody.className = 'empty-state__body';
      emptyBody.textContent = 'Sessions you complete will appear here';

      emptyState.appendChild(emptyIcon);
      emptyState.appendChild(emptyTitle);
      emptyState.appendChild(emptyBody);
      content.appendChild(emptyState);
      return;
    }

    const list = document.createElement('div');
    list.className = 'session-list';

    sessions.forEach(session => {
      const item = buildSessionItem(session);

      // Tap → open session summary (readOnly)
      const openSession = () => {
        navigate('session-summary', { sessionId: session.id, readOnly: true });
      };
      item.addEventListener('click', openSession);
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSession(); }
      });

      // Long-press → delete
      let longPressTimer = null;

      const startLongPress = () => {
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          const confirmed = window.confirm('Delete this session?');
          if (confirmed) {
            deleteSession(session.id).then(() => {
              item.remove();
              showToast('Session deleted', 'success');
              // If the list is now empty, show empty state
              if (list.childElementCount === 0) {
                list.remove();
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';

                const emptyIcon = document.createElement('div');
                emptyIcon.className = 'empty-state__icon';
                emptyIcon.textContent = '📭';

                const emptyTitle = document.createElement('div');
                emptyTitle.className = 'empty-state__title';
                emptyTitle.textContent = 'No past sessions';

                const emptyBody = document.createElement('div');
                emptyBody.className = 'empty-state__body';
                emptyBody.textContent = 'Sessions you complete will appear here';

                emptyState.appendChild(emptyIcon);
                emptyState.appendChild(emptyTitle);
                emptyState.appendChild(emptyBody);
                content.appendChild(emptyState);
              }
            }).catch(err => {
              console.error('deleteSession error:', err);
              showToast('Failed to delete session', 'error');
            });
          }
        }, 500);
      };

      const cancelLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };

      item.addEventListener('pointerdown', startLongPress);
      item.addEventListener('pointerup', cancelLongPress);
      item.addEventListener('pointerleave', cancelLongPress);
      item.addEventListener('pointercancel', cancelLongPress);

      list.appendChild(item);
    });

    content.appendChild(list);
  }).catch(err => {
    console.error('past-sessions load error:', err);
    spinner.remove();
    showToast('Failed to load sessions', 'error');
  });
}

export function register() {
  registerScreen('past-sessions', mount);
}
