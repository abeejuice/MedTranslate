import { registerScreen, navigate } from '../router.js';
import { TEMPLATES, LANGUAGES } from '../data/templates.js';
import { pulseBtn } from '../animations.js';

const LANG_FLAGS = { hi: '🇮🇳', te: '🇮🇳', ta: '🇮🇳', ml: '🇮🇳', bn: '🇧🇩', mr: '🇮🇳', ne: '🇳🇵' };

function makeBackArrow() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M19 12H5M12 5l-7 7 7 7');
  svg.appendChild(path);
  return svg;
}

function mountSessionSetup(el, params, navigateFn) {
  let selectedTemplateId = null;
  let selectedLanguageCode = null;
  let selectedLanguageLabel = null;

  // ── Header ────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'app-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'app-header__back';
  backBtn.setAttribute('aria-label', 'Go back');
  backBtn.appendChild(makeBackArrow());
  backBtn.addEventListener('click', () => history.back());

  const headerTitle = document.createElement('div');
  headerTitle.className = 'app-header__title';
  headerTitle.textContent = 'New Session';

  header.appendChild(backBtn);
  header.appendChild(headerTitle);

  // ── Content ───────────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'screen-content';

  // Patient name field
  const nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'form-label';
  nameLabel.setAttribute('for', 'patient-name-input');
  nameLabel.textContent = 'Patient Name / ID (optional)';

  const nameInput = document.createElement('input');
  nameInput.className = 'form-input';
  nameInput.id = 'patient-name-input';
  nameInput.type = 'text';
  nameInput.placeholder = 'e.g. Ramu, UHID-1234';
  nameInput.autocomplete = 'off';
  nameInput.autocorrect = 'off';
  nameInput.autocapitalize = 'words';

  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  content.appendChild(nameGroup);

  // Spacer
  const sp1 = document.createElement('div');
  sp1.style.height = 'var(--space-6)';
  content.appendChild(sp1);

  // Chief Complaint
  const complaintLabel = document.createElement('div');
  complaintLabel.className = 'form-label';
  complaintLabel.style.marginBottom = 'var(--space-3)';
  const complaintText = document.createTextNode('Chief Complaint');
  const req1 = document.createElement('span');
  req1.className = 'required';
  req1.textContent = ' *';
  req1.style.color = 'var(--color-error)';
  complaintLabel.appendChild(complaintText);
  complaintLabel.appendChild(req1);
  content.appendChild(complaintLabel);

  const grid = document.createElement('div');
  grid.className = 'complaint-grid';

  const complaintEls = [];
  TEMPLATES.forEach(template => {
    const card = document.createElement('button');
    card.className = 'complaint-card';
    card.type = 'button';
    card.setAttribute('data-template-id', template.id);

    const iconEl = document.createElement('div');
    iconEl.className = 'complaint-card__icon';
    iconEl.textContent = template.icon;

    const labelEl = document.createElement('div');
    labelEl.className = 'complaint-card__label';
    labelEl.textContent = template.label;

    card.appendChild(iconEl);
    card.appendChild(labelEl);

    card.addEventListener('click', () => {
      complaintEls.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTemplateId = template.id;
      pulseBtn(card);
      updateBeginButton();
    });

    grid.appendChild(card);
    complaintEls.push(card);
  });

  content.appendChild(grid);

  // Spacer
  const sp2 = document.createElement('div');
  sp2.style.height = 'var(--space-6)';
  content.appendChild(sp2);

  // Language section
  const langLabel = document.createElement('div');
  langLabel.className = 'form-label';
  langLabel.style.marginBottom = 'var(--space-3)';
  const langText = document.createTextNode("Patient's Language");
  const req2 = document.createElement('span');
  req2.className = 'required';
  req2.textContent = ' *';
  req2.style.color = 'var(--color-error)';
  langLabel.appendChild(langText);
  langLabel.appendChild(req2);
  content.appendChild(langLabel);

  const langRow = document.createElement('div');
  langRow.className = 'lang-grid';

  const langEls = [];
  LANGUAGES.forEach(lang => {
    const circle = document.createElement('div');
    circle.className = 'lang-circle';
    circle.setAttribute('role', 'button');
    circle.setAttribute('tabindex', '0');
    circle.setAttribute('aria-label', lang.label);

    const ring = document.createElement('div');
    ring.className = 'lang-circle__ring';

    const flag = document.createElement('div');
    flag.className = 'lang-circle__flag';
    flag.textContent = LANG_FLAGS[lang.code] || '🌐';

    const native = document.createElement('div');
    native.className = 'lang-circle__native';
    native.textContent = lang.nativeLabel;

    ring.appendChild(flag);
    ring.appendChild(native);

    const name = document.createElement('div');
    name.className = 'lang-circle__label';
    name.textContent = lang.label;

    circle.appendChild(ring);
    circle.appendChild(name);

    const select = () => {
      langEls.forEach(c => c.classList.remove('selected'));
      circle.classList.add('selected');
      selectedLanguageCode = lang.code;
      selectedLanguageLabel = lang.label;
      pulseBtn(ring);
      updateBeginButton();
    };

    circle.addEventListener('click', select);
    circle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });

    langRow.appendChild(circle);
    langEls.push(circle);
  });

  content.appendChild(langRow);

  // Bottom padding so footer doesn't cut off scroll
  const sp3 = document.createElement('div');
  sp3.style.height = 'var(--space-8)';
  content.appendChild(sp3);

  // ── Footer ────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'screen-footer';

  const beginBtn = document.createElement('button');
  beginBtn.className = 'btn btn-primary';
  beginBtn.type = 'button';
  beginBtn.textContent = 'Begin Session →';
  beginBtn.disabled = true;

  function updateBeginButton() {
    beginBtn.disabled = !(selectedTemplateId && selectedLanguageCode);
  }

  beginBtn.addEventListener('click', () => {
    if (!selectedTemplateId || !selectedLanguageCode) return;
    const template = TEMPLATES.find(t => t.id === selectedTemplateId);
    const patientLabel = nameInput.value.trim() || 'Anonymous';
    const sessionId = new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 8);
    navigateFn('session', {
      sessionId,
      patientLabel,
      templateId: selectedTemplateId,
      templateLabel: template ? template.label : selectedTemplateId,
      languageCode: selectedLanguageCode,
      languageLabel: selectedLanguageLabel,
    }, 'forward');
  });

  footer.appendChild(beginBtn);

  // ── Assemble ──────────────────────────────────────────────
  el.appendChild(header);
  el.appendChild(content);
  el.appendChild(footer);

  // ── Keyboard avoidance (visualViewport) ───────────────────
  function onViewportResize() {
    const vv = window.visualViewport;
    if (!vv) return;
    const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
    footer.style.transform = keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : '';
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
    window.visualViewport.addEventListener('scroll', onViewportResize);
  }

  el.addEventListener('_unmount', () => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewportResize);
      window.visualViewport.removeEventListener('scroll', onViewportResize);
    }
  });
}

export function register() {
  registerScreen('session-setup', (el, params) => mountSessionSetup(el, params, navigate));
}
