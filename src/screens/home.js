import { registerScreen, navigate } from '../router.js';
import { showToast } from '../toast.js';
import { getAllSessions } from '../db.js';
import { TEMPLATES } from '../data/templates.js';

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function getTemplateForSession(session) {
  if (!session.templateId) return null;
  return TEMPLATES.find(t => t.id === session.templateId) || null;
}

function buildSessionItem(session, navigateFn) {
  const template = getTemplateForSession(session);
  const icon = template ? template.icon : '📋';
  const label = template ? template.label : (session.templateId || 'Session');
  const language = session.languageLabel || session.languageCode || '';
  const patient = session.patientLabel || 'Anonymous';
  const dateStr = formatDateTime(session.startedAt);

  const item = document.createElement('div');
  item.className = 'session-item';
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');

  const iconEl = document.createElement('div');
  iconEl.className = 'session-item__icon';
  iconEl.textContent = icon;

  const body = document.createElement('div');
  body.className = 'session-item__body';

  const title = document.createElement('div');
  title.className = 'session-item__title';
  title.textContent = label;

  const meta = document.createElement('div');
  meta.className = 'session-item__meta';

  const metaParts = [];
  if (language) metaParts.push(language);
  if (patient) metaParts.push(patient);
  if (dateStr) metaParts.push(dateStr);
  meta.textContent = metaParts.join(' · ');

  body.appendChild(title);
  body.appendChild(meta);

  const chevron = document.createElement('div');
  chevron.className = 'session-item__chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';

  item.appendChild(iconEl);
  item.appendChild(body);
  item.appendChild(chevron);

  const handler = () => navigateFn('session-summary', { sessionId: session.id, readOnly: true });
  item.addEventListener('click', handler);
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  });

  return item;
}

function buildEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  const icon = document.createElement('div');
  icon.className = 'empty-state__icon';
  icon.textContent = '🏥';

  const title = document.createElement('div');
  title.className = 'empty-state__title';
  title.textContent = 'Start your first session';

  const body = document.createElement('div');
  body.className = 'empty-state__body';
  body.textContent = 'Tap the button above to begin taking history';

  empty.appendChild(icon);
  empty.appendChild(title);
  empty.appendChild(body);

  return empty;
}

async function mountHome(el, params, navigateFn) {
  // ── Header ──────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'app-header';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'app-header__title';
  headerTitle.textContent = '🩺 MedTranslate';

  const versionBadge = document.createElement('div');
  versionBadge.className = 'app-header__action';
  versionBadge.style.cssText = 'pointer-events:none;color:var(--color-text-muted);font-size:var(--font-size-xs)';
  versionBadge.textContent = 'v1.0';

  header.appendChild(headerTitle);
  header.appendChild(versionBadge);

  // ── Content ─────────────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'screen-content';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';

  // Start New Session button
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-primary';
  startBtn.style.cssText = 'margin-bottom:var(--space-5);font-size:var(--font-size-md)';
  startBtn.textContent = '+ Start New Session';
  startBtn.addEventListener('click', () => navigateFn('session-setup'));

  content.appendChild(startBtn);

  // Recent Sessions heading + list container
  const heading = document.createElement('div');
  heading.className = 'section-heading';
  heading.textContent = 'Recent Sessions';
  content.appendChild(heading);

  const listEl = document.createElement('div');
  listEl.className = 'session-list';
  content.appendChild(listEl);

  // Load sessions
  try {
    const sessions = await getAllSessions();
    const recent = sessions.slice(0, 10);
    if (recent.length === 0) {
      listEl.appendChild(buildEmptyState());
    } else {
      recent.forEach(session => {
        listEl.appendChild(buildSessionItem(session, navigateFn));
      });
    }
  } catch (err) {
    console.error('Failed to load sessions:', err);
    showToast('Could not load sessions', 'error');
    listEl.appendChild(buildEmptyState());
  }

  // ── Install banner (PWA) ─────────────────────────────────────
  let installBanner = null;
  let deferredPrompt = null;

  function showInstallBanner() {
    if (installBanner) return; // already shown

    installBanner = document.createElement('div');
    installBanner.style.cssText = [
      'background:var(--color-primary-light)',
      'color:var(--color-primary)',
      'padding:var(--space-3) var(--space-4)',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:var(--space-3)',
      'border-top:1px solid var(--color-border)',
      'font-size:var(--font-size-sm)',
    ].join(';');

    const bannerText = document.createElement('span');
    bannerText.textContent = 'Add MedTranslate to your home screen';

    const bannerActions = document.createElement('div');
    bannerActions.style.cssText = 'display:flex;gap:var(--space-2);flex-shrink:0';

    const installBtn = document.createElement('button');
    installBtn.className = 'btn btn-primary';
    installBtn.style.cssText = 'min-height:36px;padding:var(--space-2) var(--space-4);font-size:var(--font-size-sm)';
    installBtn.textContent = 'Add';
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === 'accepted') {
        installBanner.remove();
        installBanner = null;
      }
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn-ghost';
    dismissBtn.style.cssText = 'min-height:36px;padding:var(--space-2) var(--space-3);font-size:var(--font-size-sm)';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', () => {
      installBanner.remove();
      installBanner = null;
    });

    bannerActions.appendChild(installBtn);
    bannerActions.appendChild(dismissBtn);
    installBanner.appendChild(bannerText);
    installBanner.appendChild(bannerActions);

    el.appendChild(installBanner);
  }

  function onBeforeInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

  // ── Assemble screen ──────────────────────────────────────────
  el.appendChild(header);
  el.appendChild(content);

  // ── Cleanup ──────────────────────────────────────────────────
  return function cleanup() {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  };
}

export function register() {
  registerScreen('home', (el, params) => mountHome(el, params, navigate));
}
