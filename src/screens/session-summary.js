import { registerScreen, navigate } from '../router.js';
import { getSession } from '../db.js';
import { showToast } from '../toast.js';
import { TEMPLATES } from '../data/templates.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

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

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// ── Checkmark SVG ─────────────────────────────────────────────────────────────

function makeCheckmarkSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '80');
  svg.setAttribute('height', '80');
  svg.setAttribute('viewBox', '0 0 80 80');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', '40');
  circle.setAttribute('cy', '40');
  circle.setAttribute('r', '34');
  circle.setAttribute('stroke', '#F97316');
  circle.setAttribute('stroke-width', '3');
  circle.setAttribute('stroke-linecap', 'round');

  const tick = document.createElementNS(ns, 'path');
  tick.setAttribute('d', 'M24 40 L35 52 L56 28');
  tick.setAttribute('stroke', '#F97316');
  tick.setAttribute('stroke-width', '3.5');
  tick.setAttribute('stroke-linecap', 'round');
  tick.setAttribute('stroke-linejoin', 'round');
  tick.setAttribute('fill', 'none');

  svg.appendChild(circle);
  svg.appendChild(tick);
  return { svg, circle, tick };
}

function animateCheckmark(circle, tick) {
  if (typeof gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const circleLen = 2 * Math.PI * 34;
  circle.style.strokeDasharray = circleLen;
  circle.style.strokeDashoffset = circleLen;

  const tickLen = tick.getTotalLength ? tick.getTotalLength() : 60;
  tick.style.strokeDasharray = tickLen;
  tick.style.strokeDashoffset = tickLen;

  const tl = gsap.timeline({ delay: 0.1 });
  tl.to(circle, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' })
    .to(tick, { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, '-=0.1');
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportAsPDF(session, formattedDate, formattedDuration) {
  if (!window.jspdf) {
    showToast('PDF library not loaded. Please reload the app.', 'error');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('MedTranslate — Session Transcript', 20, 20);

  doc.setFontSize(11);
  doc.text(`Patient: ${session.patientLabel || 'Unknown'}`, 20, 35);
  doc.text(`Chief Complaint: ${session.templateLabel || ''}`, 20, 42);
  doc.text(`Language: ${session.languageLabel || ''}`, 20, 49);
  doc.text(`Date: ${formattedDate}`, 20, 56);
  doc.text(`Duration: ${formattedDuration}`, 20, 63);

  let y = 78;
  const qaLog = session.qaLog || [];
  qaLog.forEach((qa, i) => {
    const qLines = doc.splitTextToSize(`Q${i + 1}: ${qa.questionEnglish || ''}`, 170);
    const aLines = doc.splitTextToSize(`A: ${qa.answerEnglish || qa.answerOriginal || qa.answerTranscript || ''}`, 170);
    const blockH = (qLines.length + aLines.length) * 6 + 6;
    if (y + blockH > 270) { doc.addPage(); y = 20; }
    doc.setFont(undefined, 'bold');
    doc.text(qLines, 20, y); y += qLines.length * 6 + 2;
    doc.setFont(undefined, 'normal');
    doc.text(aLines, 20, y); y += aLines.length * 6 + 6;
  });

  const filename = `MedTranslate_${(session.patientLabel || 'session').replace(/\s+/g, '_')}_${(session.startedAt || '').slice(0, 10)}.pdf`;
  doc.save(filename);
}

function exportAsText(session, formattedDate, formattedDuration) {
  const lines = [
    'MedTranslate Session Transcript',
    '============================',
    `Patient: ${session.patientLabel || 'Unknown'}`,
    `Chief Complaint: ${session.templateLabel || ''}`,
    `Language: ${session.languageLabel || ''}`,
    `Date: ${formattedDate}`,
    `Duration: ${formattedDuration}`,
    '',
  ];

  const qaLog = session.qaLog || [];
  qaLog.forEach((qa, i) => {
    lines.push(`Q${i + 1}: ${qa.questionEnglish || ''}`);
    lines.push(`A${i + 1}: ${qa.answerEnglish || qa.answerOriginal || qa.answerTranscript || ''}`);
    lines.push('');
  });

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MedTranslate_${(session.patientLabel || 'session').replace(/\s+/g, '_')}_${(session.startedAt || '').slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Mount ─────────────────────────────────────────────────────────────────────

function mount(el, params) {
  const { sessionId, readOnly = false } = params || {};

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
  headerTitle.textContent = 'Session Summary';

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

  // ── Load & render ─────────────────────────────────────────────────────────
  getSession(sessionId).then(session => {
    if (!session) { showToast('Session not found', 'error'); history.back(); return; }

    const formattedDate = formatDate(session.startedAt);
    const formattedDuration = formatDuration(session.durationSeconds);
    const qaLog = session.qaLog || [];
    const templateIcon = getTemplateIcon(session.templateId);

    clearNode(content);

    // Checkmark hero
    if (!readOnly) {
      const checkWrap = document.createElement('div');
      checkWrap.className = 'summary-checkmark';
      const { svg, circle, tick } = makeCheckmarkSvg();
      checkWrap.appendChild(svg);
      content.appendChild(checkWrap);
      requestAnimationFrame(() => animateCheckmark(circle, tick));
    }

    // Metadata card
    const metaCard = document.createElement('div');
    metaCard.className = 'summary-meta-card';

    const patientEl = document.createElement('div');
    patientEl.className = 'summary-meta-card__patient';
    patientEl.textContent = session.patientLabel || 'Patient';

    const tagsRow = document.createElement('div');
    tagsRow.className = 'summary-meta-card__row';

    const makeTag = text => {
      const tag = document.createElement('span');
      tag.className = 'summary-tag';
      tag.textContent = text;
      return tag;
    };

    tagsRow.appendChild(makeTag(`${templateIcon} ${session.templateLabel || ''}`));
    tagsRow.appendChild(makeTag(session.languageLabel || ''));
    tagsRow.appendChild(makeTag(`⏱ ${formattedDuration}`));
    tagsRow.appendChild(makeTag(`${qaLog.length} Q`));

    const dateRow = document.createElement('div');
    dateRow.style.cssText = 'font-size:12px;color:var(--color-text-3);margin-top:var(--space-2)';
    dateRow.textContent = formattedDate;

    metaCard.appendChild(patientEl);
    metaCard.appendChild(tagsRow);
    metaCard.appendChild(dateRow);
    content.appendChild(metaCard);

    // Transcript heading
    if (qaLog.length > 0) {
      const sectionHead = document.createElement('div');
      sectionHead.className = 'section-heading';
      sectionHead.textContent = 'TRANSCRIPT';
      content.appendChild(sectionHead);
    }

    // Q&A items
    if (qaLog.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-state';
      emptyMsg.style.padding = '24px 0';
      const emptyText = document.createElement('div');
      emptyText.className = 'empty-state__body';
      emptyText.textContent = 'No questions were recorded in this session.';
      emptyMsg.appendChild(emptyText);
      content.appendChild(emptyMsg);
    } else {
      qaLog.forEach((qa) => {
        const item = document.createElement('div');
        item.className = 'qa-item';

        const questionEl = document.createElement('div');
        questionEl.className = 'qa-item__question';
        questionEl.textContent = qa.questionEnglish || '';

        const answerEl = document.createElement('div');
        answerEl.className = 'qa-item__answer';
        answerEl.textContent = qa.answerEnglish || qa.answerOriginal || qa.answerTranscript || '';

        item.appendChild(questionEl);
        item.appendChild(answerEl);

        if (qa.isCustom) {
          const badge = document.createElement('span');
          badge.className = 'qa-item__badge';
          badge.textContent = 'CUSTOM';
          item.appendChild(badge);
        }

        content.appendChild(item);
      });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'screen-footer';

    const exportRow = document.createElement('div');
    exportRow.className = 'export-row';

    const pdfBtn = document.createElement('button');
    pdfBtn.className = 'btn btn-primary';
    pdfBtn.textContent = 'Export PDF';
    pdfBtn.addEventListener('click', () => exportAsPDF(session, formattedDate, formattedDuration));

    const txtBtn = document.createElement('button');
    txtBtn.className = 'btn btn-secondary';
    txtBtn.textContent = 'Export Text';
    txtBtn.addEventListener('click', () => exportAsText(session, formattedDate, formattedDuration));

    exportRow.appendChild(pdfBtn);
    exportRow.appendChild(txtBtn);
    footer.appendChild(exportRow);

    if (!readOnly) {
      const newSessionBtn = document.createElement('button');
      newSessionBtn.className = 'btn btn-ghost';
      newSessionBtn.textContent = 'Back to Home';
      newSessionBtn.addEventListener('click', () => navigate('home'));
      footer.appendChild(newSessionBtn);
    }

    if (footer.children.length > 0) {
      el.appendChild(footer);
    }
  }).catch(err => {
    console.error('session-summary load error:', err);
    showToast('Failed to load session', 'error');
    history.back();
  });
}

export function register() {
  registerScreen('session-summary', mount);
}
