import { registerScreen, navigate } from '../router.js';
import { showToast } from '../toast.js';
import { getAllSessions } from '../db.js';
import { TEMPLATES } from '../data/templates.js';
import { staggerCards } from '../animations.js';

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function buildSessionItem(session, navigateFn) {
  const template = TEMPLATES.find(t => t.id === session.templateId);
  const icon = template ? template.icon : '📋';
  const label = template ? template.label : (session.templateLabel || session.templateId || 'Session');
  const patient = session.patientLabel || 'Anonymous';
  const lang = session.languageLabel || session.languageCode || '';
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
  title.textContent = patient;

  const meta = document.createElement('div');
  meta.className = 'session-item__meta';
  const parts = [];
  if (lang) parts.push(lang);
  if (label) parts.push(label);
  meta.textContent = parts.join(' · ');

  body.appendChild(title);
  body.appendChild(meta);

  const timestamp = document.createElement('div');
  timestamp.className = 'session-item__timestamp';
  timestamp.textContent = dateStr;

  item.appendChild(iconEl);
  item.appendChild(body);
  item.appendChild(timestamp);

  const handler = () => navigateFn('session-summary', { sessionId: session.id, readOnly: true }, 'forward');
  item.addEventListener('click', handler);
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
  });

  return item;
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

function buildEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'empty-state__icon';
  iconWrap.appendChild(makeStethoscopeSvg());

  const title = document.createElement('div');
  title.className = 'empty-state__title';
  title.textContent = 'No sessions yet';

  const body = document.createElement('div');
  body.className = 'empty-state__body';
  body.textContent = 'Tap the button above to start your first consultation';

  empty.appendChild(iconWrap);
  empty.appendChild(title);
  empty.appendChild(body);

  return empty;
}

async function mountHome(el, params, navigateFn) {
  // ── Header ────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'app-header';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'app-header__title';
  headerTitle.textContent = 'Kya? What? Entha?';

  const dot = document.createElement('span');
  dot.className = 'pulse-dot';
  headerTitle.appendChild(dot);

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

  const installBtn = document.createElement('button');
  installBtn.className = 'app-header__install';
  installBtn.setAttribute('aria-label', 'Install app');
  const installIcon = document.createElement('i');
  installIcon.className = 'fa-solid fa-download';
  installBtn.appendChild(installIcon);
  installBtn.style.display = 'none';
  installBtn.addEventListener('click', async () => {
    if (!window._installPromptEvent) return;
    window._installPromptEvent.prompt();
    const { outcome } = await window._installPromptEvent.userChoice;
    if (outcome === 'accepted') installBtn.style.display = 'none';
    window._installPromptEvent = null;
  });
  document.addEventListener('installprompt:ready', () => { installBtn.style.display = ''; });
  if (window._installPromptEvent) installBtn.style.display = '';

  header.appendChild(headerTitle);
  header.appendChild(galenLogo);
  header.appendChild(installBtn);

  // ── Content ───────────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'screen-content';

  // iOS install nudge banner
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone = ('standalone' in navigator) && navigator.standalone;
  const iosDismissed = localStorage.getItem('galenInstallDismissed');
  if (isIos && !isInStandalone && !iosDismissed) {
    const banner = document.createElement('div');
    banner.className = 'ios-install-banner';

    const bannerText = document.createElement('span');
    bannerText.className = 'ios-install-banner__text';
    bannerText.textContent = 'Install this app: tap ';
    const shareIcon = document.createElement('i');
    shareIcon.className = 'fa-solid fa-arrow-up-from-bracket';
    const bannerText2 = document.createTextNode(' then ');
    const strong = document.createElement('strong');
    strong.textContent = 'Add to Home Screen';
    bannerText.appendChild(shareIcon);
    bannerText.appendChild(bannerText2);
    bannerText.appendChild(strong);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ios-install-banner__close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
      localStorage.setItem('galenInstallDismissed', '1');
      banner.remove();
    });

    banner.appendChild(bannerText);
    banner.appendChild(closeBtn);
    content.appendChild(banner);
  }

  // Hero
  const hero = document.createElement('div');
  hero.className = 'hero';

  const tagline = document.createElement('p');
  tagline.className = 'hero__subtitle';
  tagline.textContent = 'Because "Ahhh" is the only language we both agree on.';

  const ringWrap = document.createElement('div');
  ringWrap.className = 'btn-ring';

  const startBtn = document.createElement('button');
  startBtn.className = 'btn-start';
  startBtn.textContent = '+ Start New Session';
  startBtn.addEventListener('click', () => { navigator.vibrate?.(12); navigateFn('session-setup', {}, 'forward'); });
  ringWrap.appendChild(startBtn);

  const opdWrapper = document.createElement('div');
  opdWrapper.className = 'opd-btn-wrapper';

  const opdRingWrap = document.createElement('div');
  opdRingWrap.className = 'btn-opd-ring';
  opdRingWrap.addEventListener('click', () => { navigator.vibrate?.(12); navigateFn('quick-opd', {}, 'forward'); });

  const opdBtn = document.createElement('button');
  opdBtn.className = 'btn-opd';
  opdBtn.setAttribute('aria-label', 'Quick OPD — instant translation');

  const opdCaption = document.createElement('span');
  opdCaption.className = 'btn-opd__caption';
  opdCaption.textContent = 'OPD';

  opdRingWrap.appendChild(opdBtn);
  opdWrapper.appendChild(opdRingWrap);
  opdWrapper.appendChild(opdCaption);

  hero.appendChild(tagline);
  hero.appendChild(ringWrap);
  hero.appendChild(opdWrapper);
  content.appendChild(hero);

  // Recent sessions
  const headingRow = document.createElement('div');
  headingRow.className = 'section-heading-row';

  const heading = document.createElement('div');
  heading.className = 'section-heading';
  heading.textContent = 'Recent Sessions';
  headingRow.appendChild(heading);
  content.appendChild(headingRow);

  const listEl = document.createElement('div');
  listEl.className = 'session-list';
  content.appendChild(listEl);

  // Load sessions
  try {
    const sessions = await getAllSessions();
    const recent = sessions.slice(0, 10);
    if (sessions.length > 10) {
      const seeAll = document.createElement('button');
      seeAll.className = 'see-all-btn';
      seeAll.textContent = 'See All →';
      seeAll.addEventListener('click', () => { navigator.vibrate?.(8); navigateFn('past-sessions', {}, 'forward'); });
      headingRow.appendChild(seeAll);
    }
    if (recent.length === 0) {
      listEl.appendChild(buildEmptyState());
    } else {
      const items = recent.map(s => {
        const item = buildSessionItem(s, navigateFn);
        listEl.appendChild(item);
        return item;
      });
      staggerCards(items);
    }
  } catch (err) {
    console.error('Failed to load sessions:', err);
    showToast('Could not load sessions', 'error');
    listEl.appendChild(buildEmptyState());
  }

  // Fade in then activate the chromatic ring on the wrapper
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(ringWrap, { opacity: 0.6 }, {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.15,
      onComplete: () => ringWrap.classList.add('active'),
    });
  } else {
    ringWrap.classList.add('active');
  }

  // ── Assemble ──────────────────────────────────────────────
  el.appendChild(header);
  el.appendChild(content);
}

export function register() {
  registerScreen('home', (el, params) => mountHome(el, params, navigate));
}
