import { registerScreen, navigate } from '../router.js';
import { TEMPLATES, LANGUAGES } from '../data/templates.js';
import { pulseBtn, initLanguageCarousel } from '../animations.js';

const LANG_FLAGS = { hi: '🇮🇳', te: '🇮🇳', ta: '🇮🇳', ml: '🇮🇳', kn: '🇮🇳', bn: '🇧🇩', mr: '🇮🇳', ne: '🇳🇵' };

const FA_ICON_MAP = {
  'chest-pain':             'fa-heart-pulse',
  'breathlessness':         'fa-lungs',
  'abdominal-pain':         'fa-person',
  'fever':                  'fa-thermometer',
  'headache':               'fa-brain',
  'vomiting-nausea':        'fa-face-nauseated',
  'loss-of-consciousness':  'fa-bolt',
  'weakness-paralysis':     'fa-hand',
  'urinary-complaints':     'fa-droplet',
  'trauma-injury':          'fa-bandage',
  'general-history':        'fa-clipboard-list',
};

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

// ── Language Carousel (GSAP arc) ──────────────────────────────────────────────
function buildLangCarousel(onSelect) {
  const wrap  = document.createElement('div');
  wrap.className = 'lang-carousel-wrap';

  const track = document.createElement('div');
  track.className = 'lang-carousel';
  track.setAttribute('role', 'listbox');
  track.setAttribute('aria-label', "Patient's language");

  LANGUAGES.forEach(lang => {
    const pill = document.createElement('div');
    pill.className = 'lang-pill';
    pill.setAttribute('role', 'option');
    pill.setAttribute('aria-label', lang.label);
    pill.dataset.code  = lang.code;
    pill.dataset.label = lang.label;

    const flag = document.createElement('div');
    flag.className   = 'lang-pill__flag';
    flag.textContent = LANG_FLAGS[lang.code] || '🌐';

    const native = document.createElement('div');
    native.className   = 'lang-pill__native';
    native.textContent = lang.nativeLabel;

    const name = document.createElement('div');
    name.className   = 'lang-pill__name';
    name.textContent = lang.label;

    pill.appendChild(flag);
    pill.appendChild(native);
    pill.appendChild(name);
    track.appendChild(pill);
  });

  wrap.appendChild(track);

  // Deferred init — must be called after wrap is in the DOM
  wrap._startCarousel = (cb) => initLanguageCarousel(wrap, cb);
  return wrap;
}

// ── Complaint Tile Grid ───────────────────────────────────────────────────────
function buildComplaintGrid(onSelect) {
  const grid = document.createElement('div');
  grid.className = 'complaint-grid';

  let selectedItem = null;

  TEMPLATES.forEach(template => {
    const item = document.createElement('div');
    item.className = 'complaint-tile';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', template.label);

    const iconWrap = document.createElement('div');
    iconWrap.className = 'complaint-tile__icon';

    const icon = document.createElement('i');
    icon.className = `fa-solid ${FA_ICON_MAP[template.id] || 'fa-circle-dot'}`;
    icon.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(icon);

    const label = document.createElement('div');
    label.className = 'complaint-tile__label';
    label.textContent = template.label;

    item.appendChild(iconWrap);
    item.appendChild(label);

    const select = () => {
      if (selectedItem) selectedItem.classList.remove('selected');
      selectedItem = item;
      item.classList.add('selected');

      gsap.timeline()
        .to(item, { scale: 1.04, duration: 0.08, ease: 'power2.out' })
        .to(item, { scale: 1,    duration: 0.18, ease: 'back.out(2.5)', clearProps: 'transform' });

      onSelect(template.id, template.label);
    };

    item.addEventListener('click', select);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });

    grid.appendChild(item);
  });

  return grid;
}

// ── Main mount ────────────────────────────────────────────────────────────────
function mountSessionSetup(el, params, navigateFn) {
  let selectedTemplateId    = null;
  let selectedLanguageCode  = null;
  let selectedLanguageLabel = null;
  let cleanupCarousel       = null;
  let beginBtn              = null;

  // ── Header ────────────────────────────────────────────
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

  // ── Content ───────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'screen-content';

  // ── 1. Language carousel ──────────────────────────────
  const langLabel = document.createElement('div');
  langLabel.className = 'form-label';
  langLabel.style.marginBottom = 'var(--space-3)';
  const req1 = document.createElement('span');
  req1.textContent = ' *';
  req1.style.color = 'var(--color-error)';
  langLabel.appendChild(document.createTextNode("Patient's Language"));
  langLabel.appendChild(req1);
  content.appendChild(langLabel);

  const carousel = buildLangCarousel((code, label) => {
    selectedLanguageCode  = code;
    selectedLanguageLabel = label;
    updateBeginButton();
  });
  content.appendChild(carousel);

  const sp1 = document.createElement('div');
  sp1.style.height = 'var(--space-6)';
  content.appendChild(sp1);

  // ── 2. Chief Complaint deck ───────────────────────────
  const complaintLabel = document.createElement('div');
  complaintLabel.className = 'form-label';
  complaintLabel.style.marginBottom = 'var(--space-3)';
  const req2 = document.createElement('span');
  req2.textContent = ' *';
  req2.style.color = 'var(--color-error)';
  complaintLabel.appendChild(document.createTextNode('Chief Complaint'));
  complaintLabel.appendChild(req2);
  content.appendChild(complaintLabel);

  const deck = buildComplaintGrid((id) => {
    selectedTemplateId = id;
    updateBeginButton();
  });
  content.appendChild(deck);

  const sp2 = document.createElement('div');
  sp2.style.height = 'var(--space-6)';
  content.appendChild(sp2);

  // ── 3. Patient Name (optional) ────────────────────────
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
  nameInput.autocorrect  = 'off';
  nameInput.autocapitalize = 'words';

  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  content.appendChild(nameGroup);

  const sp3 = document.createElement('div');
  sp3.style.height = 'var(--space-8)';
  content.appendChild(sp3);

  // ── Footer ────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'screen-footer';

  beginBtn = document.createElement('button');
  beginBtn.className = 'btn btn-primary';
  beginBtn.type = 'button';
  beginBtn.textContent = 'Begin Session →';
  beginBtn.disabled = true;

  function updateBeginButton() {
    if (beginBtn) beginBtn.disabled = !(selectedTemplateId && selectedLanguageCode);
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

  // ── Assemble ──────────────────────────────────────────
  el.appendChild(header);
  el.appendChild(content);
  el.appendChild(footer);

  // Start GSAP carousel after DOM is mounted
  requestAnimationFrame(() => {
    cleanupCarousel = carousel._startCarousel((code, label) => {
      selectedLanguageCode  = code;
      selectedLanguageLabel = label;
      updateBeginButton();
    });
  });

  // ── Keyboard avoidance ────────────────────────────────
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
    cleanupCarousel?.();
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewportResize);
      window.visualViewport.removeEventListener('scroll', onViewportResize);
    }
  });
}

export function register() {
  registerScreen('session-setup', (el, params) => mountSessionSetup(el, params, navigate));
}
