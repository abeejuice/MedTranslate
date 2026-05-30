import { registerScreen, navigate } from '../router.js';
import { getAllSessions, deleteSession } from '../db.js';
import { showToast } from '../toast.js';
import { TEMPLATES } from '../data/templates.js';
import { staggerCards } from '../animations.js';
import { showBottomSheet } from '../utils.js';

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

function makeStethoscopeSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '64');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', '32');
  circle.setAttribute('cy', '32');
  circle.setAttribute('r', '28');
  circle.setAttribute('stroke', '#2A2A2A');
  circle.setAttribute('stroke-width', '2');

  const arc = document.createElementNS(ns, 'path');
  arc.setAttribute('d', 'M22 28 C22 20 27 16 32 16 C37 16 42 20 42 28 L42 34 C42 40 37 44 32 44');
  arc.setAttribute('stroke', '#3A3A3A');
  arc.setAttribute('stroke-width', '2.5');
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('fill', 'none');

  const stem = document.createElementNS(ns, 'line');
  stem.setAttribute('x1', '32');
  stem.setAttribute('y1', '44');
  stem.setAttribute('x2', '32');
  stem.setAttribute('y2', '50');
  stem.setAttribute('stroke', '#3A3A3A');
  stem.setAttribute('stroke-width', '2.5');
  stem.setAttribute('stroke-linecap', 'round');

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', '32');
  dot.setAttribute('cy', '52');
  dot.setAttribute('r', '2.5');
  dot.setAttribute('fill', '#3A3A3A');

  svg.appendChild(circle);
  svg.appendChild(arc);
  svg.appendChild(stem);
  svg.appendChild(dot);
  return svg;
}

// ── Build session item ────────────────────────────────────────────────────────

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

  body.appendChild(title);
  body.appendChild(meta);

  const timestamp = document.createElement('div');
  timestamp.className = 'session-item__timestamp';
  timestamp.textContent = formatDate(session.startedAt);

  item.appendChild(iconEl);
  item.appendChild(body);
  item.appendChild(timestamp);

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

  const galenLogo = document.createElement('a');
  galenLogo.className = 'app-header__logo';
  galenLogo.href = 'https://app.galenai.io/';
  galenLogo.target = '_blank';
  galenLogo.rel = 'noopener noreferrer';
  galenLogo.setAttribute('aria-label', 'GalenAI');
  const galenImg = document.createElement('img');
  galenImg.src = '/icons/GalenAI-FInal Logo-01.svg';
  galenImg.alt = 'GalenAI';
  galenImg.width = 32;
  galenImg.height = 32;
  galenLogo.appendChild(galenImg);

  header.appendChild(backBtn);
  header.appendChild(headerTitle);
  header.appendChild(galenLogo);
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
    spinner.remove();

    if (!sessions || sessions.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'empty-state__icon';
      iconWrap.appendChild(makeStethoscopeSvg());

      const emptyTitle = document.createElement('div');
      emptyTitle.className = 'empty-state__title';
      emptyTitle.textContent = 'No past sessions';

      const emptyBody = document.createElement('div');
      emptyBody.className = 'empty-state__body';
      emptyBody.textContent = 'Sessions you complete will appear here';

      emptyState.appendChild(iconWrap);
      emptyState.appendChild(emptyTitle);
      emptyState.appendChild(emptyBody);
      content.appendChild(emptyState);
      return;
    }

    const list = document.createElement('div');
    list.className = 'session-list';
    const items = [];

    sessions.forEach(session => {
      const item = buildSessionItem(session);

      const openSession = () => {
        navigate('session-summary', { sessionId: session.id, readOnly: true }, 'forward');
      };
      item.addEventListener('click', openSession);
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSession(); }
      });

      // Long-press to delete
      let longPressTimer = null;

      const startLongPress = () => {
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          showBottomSheet({
            title: 'Delete Session?',
            message: 'This cannot be undone.',
            actions: [
              { label: 'Delete', style: 'destructive', onClick: () => {
                  deleteSession(session.id).then(() => {
                    item.remove();
                    showToast('Session deleted', 'success');
                    if (list.childElementCount === 0) {
                      list.remove();
                      const emptyState = document.createElement('div');
                      emptyState.className = 'empty-state';
                      const iconWrap = document.createElement('div');
                      iconWrap.className = 'empty-state__icon';
                      iconWrap.appendChild(makeStethoscopeSvg());
                      const emptyTitle = document.createElement('div');
                      emptyTitle.className = 'empty-state__title';
                      emptyTitle.textContent = 'No past sessions';
                      const emptyBody = document.createElement('div');
                      emptyBody.className = 'empty-state__body';
                      emptyBody.textContent = 'Sessions you complete will appear here';
                      emptyState.appendChild(iconWrap);
                      emptyState.appendChild(emptyTitle);
                      emptyState.appendChild(emptyBody);
                      content.appendChild(emptyState);
                    }
                  }).catch(err => {
                    console.error('deleteSession error:', err);
                    showToast('Failed to delete session', 'error');
                  });
                }
              },
              { label: 'Cancel', style: 'cancel' },
            ],
          });
        }, 500);
      };

      const cancelLongPress = () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      };

      item.addEventListener('pointerdown', startLongPress);
      item.addEventListener('pointerup', cancelLongPress);
      item.addEventListener('pointerleave', cancelLongPress);
      item.addEventListener('pointercancel', cancelLongPress);

      list.appendChild(item);
      items.push(item);
    });

    const hintEl = document.createElement('div');
    hintEl.style.cssText = 'font-size:12px;color:var(--color-text-3);text-align:center;padding:var(--space-2) 0 var(--space-3);';
    hintEl.textContent = 'Hold a session to delete it';
    content.appendChild(hintEl);
    content.appendChild(list);
    staggerCards(items);
  }).catch(err => {
    console.error('past-sessions load error:', err);
    spinner.remove();
    showToast('Failed to load sessions', 'error');
  });
}

export function register() {
  registerScreen('past-sessions', mount);
}
