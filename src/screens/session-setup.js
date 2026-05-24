import { registerScreen, navigate } from '../router.js';
import { TEMPLATES, LANGUAGES } from '../data/templates.js';

function makeBackArrow() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M19 12H5M12 5l-7 7 7 7');
  svg.appendChild(path);
  return svg;
}

function mountSessionSetup(el, params, navigateFn) {
  let selectedTemplateId = null;
  let selectedLanguageCode = null;
  let selectedLanguageLabel = null;

  // ── Header ──────────────────────────────────────────────────
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

  // ── Content ─────────────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'screen-content';

  // Patient Name / ID field
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
  const spacer1 = document.createElement('div');
  spacer1.style.height = 'var(--space-5)';
  content.appendChild(spacer1);

  // Chief Complaint section
  const complaintLabelEl = document.createElement('div');
  complaintLabelEl.className = 'form-label';
  complaintLabelEl.style.marginBottom = 'var(--space-3)';

  const complaintLabelText = document.createTextNode('Chief Complaint');
  const requiredMark = document.createElement('span');
  requiredMark.textContent = ' *';
  requiredMark.style.color = 'var(--color-error)';
  complaintLabelEl.appendChild(complaintLabelText);
  complaintLabelEl.appendChild(requiredMark);
  content.appendChild(complaintLabelEl);

  const grid = document.createElement('div');
  grid.className = 'complaint-grid';

  const cardEls = [];

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
      // Deselect all
      cardEls.forEach(c => c.classList.remove('selected'));
      // Select this one
      card.classList.add('selected');
      selectedTemplateId = template.id;
      updateBeginButton();
    });

    grid.appendChild(card);
    cardEls.push(card);
  });

  content.appendChild(grid);

  // Spacer
  const spacer2 = document.createElement('div');
  spacer2.style.height = 'var(--space-5)';
  content.appendChild(spacer2);

  // Language select section
  const langGroup = document.createElement('div');
  langGroup.className = 'form-group';

  const langLabel = document.createElement('label');
  langLabel.className = 'form-label';
  langLabel.setAttribute('for', 'language-select');

  const langLabelText = document.createTextNode("Patient's Language");
  const requiredMark2 = document.createElement('span');
  requiredMark2.textContent = ' *';
  requiredMark2.style.color = 'var(--color-error)';
  langLabel.appendChild(langLabelText);
  langLabel.appendChild(requiredMark2);

  const langSelect = document.createElement('select');
  langSelect.className = 'form-select';
  langSelect.id = 'language-select';

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = 'Select language';
  placeholderOpt.disabled = true;
  placeholderOpt.selected = true;
  langSelect.appendChild(placeholderOpt);

  LANGUAGES.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    // Safely compose text: "Hindi — हिन्दी"
    opt.textContent = lang.label + ' — ' + lang.nativeLabel;
    langSelect.appendChild(opt);
  });

  langSelect.addEventListener('change', () => {
    const selectedCode = langSelect.value;
    const lang = LANGUAGES.find(l => l.code === selectedCode);
    if (lang) {
      selectedLanguageCode = lang.code;
      selectedLanguageLabel = lang.label;
    } else {
      selectedLanguageCode = null;
      selectedLanguageLabel = null;
    }
    updateBeginButton();
  });

  langGroup.appendChild(langLabel);
  langGroup.appendChild(langSelect);
  content.appendChild(langGroup);

  // ── Footer (Begin Session button) ───────────────────────────
  const footer = document.createElement('div');
  footer.className = 'screen-footer';

  const beginBtn = document.createElement('button');
  beginBtn.className = 'btn btn-primary';
  beginBtn.type = 'button';
  beginBtn.textContent = 'Begin Session';
  beginBtn.disabled = true;

  function updateBeginButton() {
    beginBtn.disabled = !(selectedTemplateId && selectedLanguageCode);
  }

  beginBtn.addEventListener('click', () => {
    if (!selectedTemplateId || !selectedLanguageCode) return;

    const patientLabel = nameInput.value.trim() || 'Anonymous';
    const sessionId = new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 8);

    navigateFn('session', {
      sessionId,
      patientLabel,
      templateId: selectedTemplateId,
      languageCode: selectedLanguageCode,
      languageLabel: selectedLanguageLabel,
    });
  });

  footer.appendChild(beginBtn);

  // ── Assemble screen ──────────────────────────────────────────
  el.appendChild(header);
  el.appendChild(content);
  el.appendChild(footer);

  // No timers or global listeners to clean up
}

export function register() {
  registerScreen('session-setup', (el, params) => mountSessionSetup(el, params, navigate));
}
