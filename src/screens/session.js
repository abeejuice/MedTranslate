import { registerScreen, navigate } from '../router.js';
import { saveSession, getCachedTranslations, setCachedTranslations } from '../db.js';
import { getTemplate, getLanguage, LANGUAGES } from '../data/templates.js';
import { showToast } from '../toast.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function makeWaveform() {
  const waveform = document.createElement('div');
  waveform.className = 'waveform';
  for (let i = 0; i < 6; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform__bar';
    waveform.appendChild(bar);
  }
  return waveform;
}

function makeSpinnerEl() {
  const s = document.createElement('div');
  s.className = 'spinner';
  return s;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// ── Card builder ─────────────────────────────────────────────────────────────

function buildQuestionCard(q, allCards, onPlayClick, onRecordClick) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  const englishEl = document.createElement('div');
  englishEl.className = 'question-card__english';
  englishEl.textContent = q.english;
  card.appendChild(englishEl);

  const expandedContent = document.createElement('div');
  expandedContent.style.display = 'none';

  const romanisedEl = document.createElement('div');
  romanisedEl.className = 'question-card__romanised';
  romanisedEl.textContent = q.romanised || '(loading…)';

  const nativeEl = document.createElement('div');
  nativeEl.className = 'question-card__native';
  nativeEl.textContent = q.native || '';
  if (!q.native) nativeEl.style.display = 'none';

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'question-card__actions';

  const playBtn = document.createElement('button');
  playBtn.className = 'btn-play';
  playBtn.textContent = '▶ Play';
  playBtn.setAttribute('aria-label', 'Play question audio');

  const recordBtn = document.createElement('button');
  recordBtn.className = 'btn-record';
  recordBtn.textContent = '● Record';
  recordBtn.setAttribute('aria-label', 'Record patient answer');

  actionsDiv.appendChild(playBtn);
  actionsDiv.appendChild(recordBtn);

  const answerDisplay = document.createElement('div');
  answerDisplay.className = 'answer-display';
  answerDisplay.style.display = 'none';

  const answerEnglish = document.createElement('div');
  answerEnglish.className = 'answer-display__english';

  const answerOriginal = document.createElement('div');
  answerOriginal.className = 'answer-display__original';

  answerDisplay.appendChild(answerEnglish);
  answerDisplay.appendChild(answerOriginal);

  expandedContent.appendChild(romanisedEl);
  expandedContent.appendChild(nativeEl);
  expandedContent.appendChild(actionsDiv);
  expandedContent.appendChild(answerDisplay);
  card.appendChild(expandedContent);

  let waveformEl = null;

  function toggleExpand(e) {
    if (e.target.closest('button')) return;
    const isExpanded = card.classList.contains('expanded');
    allCards.forEach(c => {
      c.card.classList.remove('expanded');
      c.expandedContent.style.display = 'none';
    });
    if (!isExpanded) {
      card.classList.add('expanded');
      expandedContent.style.display = '';
    }
  }
  card.addEventListener('click', toggleExpand);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(e); });

  playBtn.addEventListener('click', () => onPlayClick(q, playBtn));
  recordBtn.addEventListener('click', () => {
    onRecordClick(q, recordBtn, actionsDiv, answerDisplay, answerEnglish, answerOriginal, {
      showWaveform() {
        if (!waveformEl) { waveformEl = makeWaveform(); actionsDiv.appendChild(waveformEl); }
        waveformEl.classList.remove('stopped');
      },
      stopWaveform() { if (waveformEl) waveformEl.classList.add('stopped'); },
    });
  });

  function updateTranslation(romanised, native) {
    romanisedEl.textContent = romanised || '(English only)';
    if (native) { nativeEl.textContent = native; nativeEl.style.display = ''; }
    else { nativeEl.style.display = 'none'; }
  }

  return { card, expandedContent, updateTranslation };
}

// ── Mount ─────────────────────────────────────────────────────────────────────

async function mountSession(el, params) {
  const { sessionId, patientLabel, templateId, languageLabel } = params;
  let { languageCode } = params;

  const template = getTemplate(templateId);
  if (!template) { showToast('Template not found', 'error'); navigate('home'); return; }

  const abortController = new AbortController();
  const { signal } = abortController;

  let mediaRecorder = null;
  let activeStream = null;

  const session = {
    id: sessionId,
    patientLabel,
    templateId,
    templateLabel: template.label,
    languageCode,
    languageLabel,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationSeconds: 0,
    qaLog: [],
  };

  // allCards registry shared with card builder for collapse-all
  const allCards = [];

  // ── Header ────────────────────────────────────────────────────────────────

  const header = document.createElement('div');
  header.className = 'app-header';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'app-header__back';
  closeBtn.setAttribute('aria-label', 'Close session');
  closeBtn.textContent = '✕';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'app-header__title';
  headerTitle.textContent = template.label + ' — ' + patientLabel;

  const langSelect = document.createElement('select');
  langSelect.className = 'lang-badge';
  langSelect.setAttribute('aria-label', 'Change patient language');
  LANGUAGES.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.label;
    if (lang.code === languageCode) opt.selected = true;
    langSelect.appendChild(opt);
  });

  const endBtn = document.createElement('button');
  endBtn.className = 'app-header__action';
  endBtn.textContent = 'End Session';

  header.appendChild(closeBtn);
  header.appendChild(headerTitle);
  header.appendChild(langSelect);
  header.appendChild(endBtn);

  // ── Content ───────────────────────────────────────────────────────────────

  const content = document.createElement('div');
  content.className = 'screen-content';
  content.style.paddingBottom = '80px';

  const sectionHeading = document.createElement('div');
  sectionHeading.className = 'section-heading';
  content.appendChild(sectionHeading);

  const cardsContainer = document.createElement('div');
  content.appendChild(cardsContainer);

  // ── Custom question bar ───────────────────────────────────────────────────

  const customBar = document.createElement('div');
  customBar.className = 'custom-q-bar';

  const customInput = document.createElement('input');
  customInput.className = 'custom-q-bar__input';
  customInput.type = 'text';
  customInput.placeholder = 'Ask something else…';
  customInput.setAttribute('aria-label', 'Type a custom question');

  const sendBtn = document.createElement('button');
  sendBtn.className = 'custom-q-bar__send';
  sendBtn.setAttribute('aria-label', 'Send custom question');
  sendBtn.textContent = '→ Send';

  customBar.appendChild(customInput);
  customBar.appendChild(sendBtn);

  el.appendChild(header);
  el.appendChild(content);
  el.appendChild(customBar);

  // ── Heading count helper ──────────────────────────────────────────────────

  function updateHeading() {
    const customCount = allCards.filter(c => c.q && c.q.isCustom).length;
    sectionHeading.textContent = 'QUESTIONS (' + (template.questions.length + customCount) + ')';
  }

  // ── Build template cards ──────────────────────────────────────────────────

  function buildTemplateCards(translations) {
    clearChildren(cardsContainer);
    allCards.length = 0;
    template.questions.forEach((q, i) => {
      const t = translations ? translations[i] : null;
      const enriched = { ...q, romanised: t ? t.romanised : null, native: t ? t.native : null };
      const { card, expandedContent, updateTranslation } = buildQuestionCard(
        enriched, allCards, handlePlay, handleRecord
      );
      allCards.push({ card, expandedContent, updateTranslation, q: enriched });
      cardsContainer.appendChild(card);
    });
    updateHeading();
  }

  buildTemplateCards(null);
  saveSession(session).catch(err => console.error('saveSession:', err));

  // ── Translations ──────────────────────────────────────────────────────────

  async function loadTranslations(langCode, langLabelArg) {
    const cacheKey = 'translations:' + templateId + ':' + langCode;
    try {
      const cached = await getCachedTranslations(cacheKey);
      if (cached) { applyTranslations(cached); return; }

      const res = await fetch('/.netlify/functions/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: template.questions.map(q => q.english),
          targetLang: langCode,
          targetLangLabel: langLabelArg,
        }),
        signal,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      await setCachedTranslations(cacheKey, data.translations);
      applyTranslations(data.translations);
    } catch (err) {
      if (err.name === 'AbortError') return;
      showToast('Could not load translations. Showing English only.', 'error');
      // Apply English-only fallback for template cards (custom cards not affected)
      allCards.filter(c => !c.q.isCustom).forEach(c => c.updateTranslation(null, null));
    }
  }

  function applyTranslations(translations) {
    const templateCards = allCards.filter(c => !c.q.isCustom);
    templateCards.forEach((c, i) => {
      if (translations && translations[i]) {
        c.updateTranslation(translations[i].romanised, translations[i].native);
      }
    });
  }

  loadTranslations(languageCode, languageLabel);

  // ── Language change ───────────────────────────────────────────────────────

  langSelect.addEventListener('change', () => {
    languageCode = langSelect.value;
    const lang = getLanguage(languageCode);
    if (!lang) return;
    session.languageCode = languageCode;
    session.languageLabel = lang.label;
    allCards.filter(c => !c.q.isCustom).forEach(c => c.updateTranslation('(loading…)', null));
    loadTranslations(languageCode, lang.label);
  });

  // ── TTS — Play ────────────────────────────────────────────────────────────

  async function handlePlay(q, btn) {
    const orig = btn.textContent;
    btn.disabled = true;
    clearChildren(btn);
    btn.appendChild(makeSpinnerEl());
    try {
      const langObj = getLanguage(languageCode);
      const res = await fetch('/.netlify/functions/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: q.english, languageCode: langObj ? langObj.sarvamCode : 'hi-IN' }),
        signal,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const audio = new Audio('data:audio/wav;base64,' + data.audio);
      audio.play();
    } catch (err) {
      if (err.name !== 'AbortError') showToast('Could not play audio', 'error');
    } finally {
      clearChildren(btn);
      btn.textContent = orig;
      btn.disabled = false;
    }
  }

  // ── STT — Record ──────────────────────────────────────────────────────────

  async function handleRecord(q, btn, actionsDiv, answerDisplay, answerEnglish, answerOriginal, waveCtrl) {
    if (btn.classList.contains('recording')) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      return;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast('Microphone access denied', 'error');
      return;
    }

    const chunks = [];
    mediaRecorder = new MediaRecorder(activeStream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      btn.classList.remove('recording');
      btn.textContent = '● Record';
      waveCtrl.stopWaveform();
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      const spinner = makeSpinnerEl();
      actionsDiv.appendChild(spinner);
      try {
        const audioBase64 = await blobToBase64(blob);
        const res = await fetch('/.netlify/functions/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, languageCode, mimeType: blob.type }),
          signal,
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        answerEnglish.textContent = data.english || '';
        answerOriginal.textContent = data.original || '';
        answerDisplay.style.display = '';

        session.qaLog.push({
          questionId: q.id,
          questionEnglish: q.english,
          answerEnglish: data.english || '',
          answerOriginal: data.original || '',
          askedAt: new Date().toISOString(),
          isCustom: q.isCustom || false,
        });
        saveSession(session).catch(err => console.error('saveSession:', err));
      } catch (err) {
        if (err.name !== 'AbortError') showToast('Could not transcribe audio', 'error');
      } finally {
        spinner.remove();
      }
    };

    mediaRecorder.start();
    btn.classList.add('recording');
    btn.textContent = '● Stop';
    waveCtrl.showWaveform();
  }

  // ── Custom question ───────────────────────────────────────────────────────

  async function submitCustomQuestion() {
    const text = customInput.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    clearChildren(sendBtn);
    sendBtn.appendChild(makeSpinnerEl());
    customInput.disabled = true;

    const lang = getLanguage(languageCode);
    const langLabelArg = lang ? lang.label : languageLabel;

    let romanised = null;
    let native = null;

    try {
      const res = await fetch('/.netlify/functions/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: [text], targetLang: languageCode, targetLangLabel: langLabelArg }),
        signal,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.translations && data.translations[0]) {
        romanised = data.translations[0].romanised;
        native = data.translations[0].native;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      showToast('Could not translate question', 'error');
    } finally {
      clearChildren(sendBtn);
      sendBtn.textContent = '→ Send';
      sendBtn.disabled = false;
      customInput.disabled = false;
      customInput.value = '';
    }

    const customQ = { id: 'custom-' + Date.now(), english: text, romanised, native, isCustom: true };
    const { card, expandedContent, updateTranslation } = buildQuestionCard(
      customQ, allCards, handlePlay, handleRecord
    );
    allCards.unshift({ card, expandedContent, updateTranslation, q: customQ });
    cardsContainer.insertBefore(card, cardsContainer.firstChild);
    updateTranslation(romanised, native);
    // Auto-expand
    card.classList.add('expanded');
    expandedContent.style.display = '';
    updateHeading();
  }

  sendBtn.addEventListener('click', submitCustomQuestion);
  customInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitCustomQuestion(); });

  // ── End Session ───────────────────────────────────────────────────────────

  async function endSession() {
    if (!confirm('End this session?')) return;
    session.endedAt = new Date().toISOString();
    session.durationSeconds = Math.round(
      (new Date(session.endedAt) - new Date(session.startedAt)) / 1000
    );
    await saveSession(session);
    navigate('session-summary', { sessionId: session.id });
  }

  endBtn.addEventListener('click', endSession);
  closeBtn.addEventListener('click', () => { if (confirm('Leave this session?')) history.back(); });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  return () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    abortController.abort();
    session.endedAt = session.endedAt || new Date().toISOString();
    session.durationSeconds = Math.round(
      (new Date(session.endedAt) - new Date(session.startedAt)) / 1000
    );
    saveSession(session).catch(() => {});
  };
}

// ── Register ──────────────────────────────────────────────────────────────────

export function register() {
  registerScreen('session', mountSession);
}
