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
    const aLines = doc.splitTextToSize(`A: ${qa.answerEnglish || qa.answerTranscript || ''}`, 170);
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
    '================================',
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
    lines.push(`A${i + 1}: ${qa.answerEnglish || qa.answerTranscript || ''}`);
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

  const exportBtn = document.createElement('button');
  exportBtn.className = 'app-header__action';
  exportBtn.textContent = 'Export';
  exportBtn.setAttribute('aria-label', 'Export session as PDF');

  header.appendChild(backBtn);
  header.appendChild(headerTitle);
  header.appendChild(exportBtn);
  el.appendChild(header);

  // ── Content placeholder (spinner while loading) ────────────────────────
  const content = document.createElement('div');
  content.className = 'screen-content';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  content.appendChild(spinner);
  el.appendChild(content);

  // ── Async load & render ───────────────────────────────────────────────────
  getSession(sessionId).then(session => {
    if (!session) {
      showToast('Session not found', 'error');
      history.back();
      return;
    }

    const formattedDate = formatDate(session.startedAt);
    const formattedDuration = formatDuration(session.durationSeconds);
    const qaLog = session.qaLog || [];
    const templateIcon = getTemplateIcon(session.templateId);

    // Wire export header button → export as PDF
    exportBtn.addEventListener('click', () => {
      exportAsPDF(session, formattedDate, formattedDuration);
    });

    // Clear spinner, build content
    clearNode(content);

    // Summary header card
    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'summary-header';

    const patientEl = document.createElement('div');
    patientEl.className = 'summary-header__patient';
    patientEl.textContent = session.patientLabel || 'Patient';
    summaryHeader.appendChild(patientEl);

    const metaRow = document.createElement('div');
    metaRow.className = 'summary-header__meta';

    const tagComplaint = document.createElement('span');
    tagComplaint.className = 'summary-header__tag';
    tagComplaint.textContent = `${templateIcon} ${session.templateLabel || ''}`;

    const tagLang = document.createElement('span');
    tagLang.className = 'summary-header__tag';
    tagLang.textContent = `🇮🇳 ${session.languageLabel || ''}`;

    metaRow.appendChild(tagComplaint);
    metaRow.appendChild(tagLang);
    summaryHeader.appendChild(metaRow);

    const statsRow = document.createElement('div');
    statsRow.className = 'summary-header__meta';
    statsRow.textContent = `⏱ ${formattedDuration}  ·  ${qaLog.length} question${qaLog.length !== 1 ? 's' : ''}`;
    summaryHeader.appendChild(statsRow);

    const dateRow = document.createElement('div');
    dateRow.className = 'summary-header__meta';
    dateRow.textContent = `📅 ${formattedDate}`;
    summaryHeader.appendChild(dateRow);

    content.appendChild(summaryHeader);

    // Section heading
    const sectionHeading = document.createElement('div');
    sectionHeading.className = 'section-heading';
    sectionHeading.textContent = 'TRANSCRIPT';
    content.appendChild(sectionHeading);

    // Q&A items
    if (qaLog.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-state';
      emptyMsg.style.padding = '24px 16px';
      emptyMsg.textContent = 'No questions were recorded in this session.';
      content.appendChild(emptyMsg);
    } else {
      qaLog.forEach((qa) => {
        const item = document.createElement('div');
        item.className = 'qa-item';

        const questionEl = document.createElement('div');
        questionEl.className = 'qa-item__question';
        questionEl.textContent = qa.questionEnglish || '';
        item.appendChild(questionEl);

        const answerEl = document.createElement('div');
        answerEl.className = 'qa-item__answer';
        answerEl.textContent = qa.answerEnglish || qa.answerTranscript || '';
        item.appendChild(answerEl);

        if (qa.isCustom) {
          const badge = document.createElement('span');
          badge.className = 'qa-item__badge';
          badge.textContent = 'CUSTOM';
          item.appendChild(badge);
        }

        const divider = document.createElement('div');
        divider.className = 'divider';
        item.appendChild(divider);

        content.appendChild(item);
      });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const showFooter = !readOnly || qaLog.length > 0;
    if (showFooter) {
      const footer = document.createElement('div');
      footer.className = 'screen-footer';

      if (qaLog.length > 0) {
        const exportRow = document.createElement('div');
        exportRow.style.cssText = 'display:flex;gap:8px;width:100%;';

        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'btn btn-secondary';
        pdfBtn.style.flex = '1';
        pdfBtn.textContent = 'Export PDF';
        pdfBtn.addEventListener('click', () => exportAsPDF(session, formattedDate, formattedDuration));

        const txtBtn = document.createElement('button');
        txtBtn.className = 'btn btn-secondary';
        txtBtn.style.flex = '1';
        txtBtn.textContent = 'Export Text';
        txtBtn.addEventListener('click', () => exportAsText(session, formattedDate, formattedDuration));

        exportRow.appendChild(pdfBtn);
        exportRow.appendChild(txtBtn);
        footer.appendChild(exportRow);
      }

      if (!readOnly) {
        const newSessionBtn = document.createElement('button');
        newSessionBtn.className = 'btn btn-primary';
        newSessionBtn.style.width = '100%';
        newSessionBtn.textContent = 'Start New Session';
        newSessionBtn.addEventListener('click', () => navigate('home'));
        footer.appendChild(newSessionBtn);
      }

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
