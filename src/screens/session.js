import { registerScreen, navigate } from '../router.js';
import { saveSession, getCachedTranslations, setCachedTranslations } from '../db.js';
import { getTemplate, getLanguage, LANGUAGES } from '../data/templates.js';
import { showToast } from '../toast.js';
import { animateOrb, staggerCards, expandCard, pulseBtn } from '../animations.js';
import { showBottomSheet } from '../utils.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function makeSpinnerEl() {
  const s = document.createElement('div');
  s.className = 'spinner';
  s.style.cssText = 'width:20px;height:20px;border-width:2px;margin:0 auto';
  return s;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function makeOrbEl() {
  const container = document.createElement('div');
  container.className = 'orb-container';

  const ball = document.createElement('div');
  ball.className = 'orb-ball';
  container.appendChild(ball);
  return container;
}

// ── Card builder ─────────────────────────────────────────────────────────────

function buildQuestionCard(q, allCards, onPlayClick, onRecordClick) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  // ── Always-visible header ──────────────────────────────────────────────────
  const cardHeader = document.createElement('div');
  cardHeader.className = 'question-card__header';

  const headerTop = document.createElement('div');
  headerTop.className = 'question-card__header-top';

  const answeredDot = document.createElement('span');
  answeredDot.className = 'question-card__answered-dot';
  answeredDot.setAttribute('aria-label', 'Answered');

  const englishEl = document.createElement('div');
  englishEl.className = 'question-card__english';
  englishEl.textContent = q.english;

  const chevronEl = document.createElement('span');
  chevronEl.className = 'question-card__chevron';
  chevronEl.textContent = '›';
  chevronEl.setAttribute('aria-hidden', 'true');

  headerTop.appendChild(answeredDot);
  headerTop.appendChild(englishEl);
  headerTop.appendChild(chevronEl);

  const nativePreviewEl = document.createElement('div');
  nativePreviewEl.className = 'question-card__native-preview skeleton';
  nativePreviewEl.textContent = q.native || '░░░░░░░░░░░░';

  const answerPreviewEl = document.createElement('div');
  answerPreviewEl.className = 'question-card__answer-preview';
  answerPreviewEl.style.display = 'none';

  cardHeader.appendChild(headerTop);
  cardHeader.appendChild(nativePreviewEl);
  cardHeader.appendChild(answerPreviewEl);
  card.appendChild(cardHeader);

  // ── Expanded content ───────────────────────────────────────────────────────
  const expandedContent = document.createElement('div');
  expandedContent.className = 'question-card__expanded';
  expandedContent.style.height = '0px';
  expandedContent.style.opacity = '0';
  expandedContent.style.overflow = 'hidden';

  // Patient zone: native + play button
  const patientZone = document.createElement('div');
  patientZone.className = 'question-card__patient-zone';

  const nativeEl = document.createElement('div');
  nativeEl.className = 'question-card__native';
  nativeEl.textContent = q.native || '';

  const playBtn = document.createElement('button');
  playBtn.className = 'btn-play';
  playBtn.textContent = 'Play in ' + (q.native ? '' : 'English');
  playBtn.setAttribute('aria-label', 'Play question audio');

  patientZone.appendChild(nativeEl);
  patientZone.appendChild(playBtn);
  if (!q.native) patientZone.style.display = 'none';

  const romanisedEl = document.createElement('div');
  romanisedEl.className = 'question-card__romanised';
  romanisedEl.textContent = q.romanised || '(loading…)';

  // Orb
  const orbEl = makeOrbEl();

  // Record section
  const recordSection = document.createElement('div');
  recordSection.className = 'question-card__record-section';

  const recordBtn = document.createElement('button');
  recordBtn.className = 'btn-record';
  recordBtn.textContent = 'Record Answer';
  recordBtn.setAttribute('aria-label', 'Record patient answer');

  recordSection.appendChild(orbEl);
  recordSection.appendChild(recordBtn);

  // Answer display
  const answerDisplay = document.createElement('div');
  answerDisplay.className = 'answer-display';
  answerDisplay.style.display = 'none';

  const answerLabelOriginal = document.createElement('div');
  answerLabelOriginal.className = 'answer-display__label';
  answerLabelOriginal.textContent = 'Patient said';

  const answerOriginal = document.createElement('div');
  answerOriginal.className = 'answer-display__original';

  const answerLabelEN = document.createElement('div');
  answerLabelEN.className = 'answer-display__label';
  answerLabelEN.textContent = 'EN:';

  const answerEnglish = document.createElement('div');
  answerEnglish.className = 'answer-display__english';

  answerDisplay.appendChild(answerLabelOriginal);
  answerDisplay.appendChild(answerOriginal);
  answerDisplay.appendChild(answerLabelEN);
  answerDisplay.appendChild(answerEnglish);

  expandedContent.appendChild(patientZone);
  expandedContent.appendChild(romanisedEl);
  expandedContent.appendChild(recordSection);
  expandedContent.appendChild(answerDisplay);
  card.appendChild(expandedContent);

  // ── Toggle expand ──────────────────────────────────────────────────────────

  function toggleExpand(e) {
    if (e.target.closest('button, canvas')) return;
    const isExpanded = card.classList.contains('expanded');

    // Collapse all other cards
    allCards.forEach(c => {
      if (c.card === card) return;
      if (c.card.classList.contains('expanded')) {
        c.card.classList.remove('expanded');
        expandCard(c.expandedContent, false);
        if (typeof gsap !== 'undefined') {
          gsap.to(c.chevronEl, { rotation: 0, duration: 0.2, ease: 'power2.out' });
        }
      }
    });

    if (isExpanded) {
      card.classList.remove('expanded');
      expandCard(expandedContent, false);
      if (typeof gsap !== 'undefined') {
        gsap.to(chevronEl, { rotation: 0, duration: 0.2, ease: 'power2.out' });
      }
    } else {
      card.classList.add('expanded');
      expandCard(expandedContent, true);
      if (typeof gsap !== 'undefined') {
        gsap.to(chevronEl, { rotation: 90, duration: 0.2, ease: 'power2.out' });
      }
    }
  }

  card.addEventListener('click', toggleExpand);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(e); }
  });

  // Orb tap = stop
  orbEl.addEventListener('click', () => {
    if (card.classList.contains('recording')) {
      recordBtn.click();
    }
  });

  playBtn.addEventListener('click', () => onPlayClick(q, playBtn, orbEl));
  recordBtn.addEventListener('click', () => {
    onRecordClick(q, recordBtn, recordSection, answerDisplay, answerEnglish, answerOriginal, {
      markAnswered(originalText) {
        card.classList.add('answered');
        nativePreviewEl.classList.remove('skeleton');
        answeredDot.style.display = 'inline-block';
        answerPreviewEl.textContent = originalText.slice(0, 60) + (originalText.length > 60 ? '…' : '');
        answerPreviewEl.style.display = '';
      },
    }, orbEl);
  });

  function updateTranslation(romanised, native) {
    romanisedEl.textContent = romanised || '(English only)';
    if (native) {
      nativePreviewEl.textContent = native;
      nativePreviewEl.classList.remove('skeleton');
      nativeEl.textContent = native;
      playBtn.textContent = 'Play';
      patientZone.style.display = '';
    } else {
      nativePreviewEl.textContent = '░░░░░░░░░░░░';
      nativePreviewEl.classList.add('skeleton');
      patientZone.style.display = 'none';
    }
  }

  return { card, expandedContent, chevronEl, updateTranslation };
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

  const allCards = [];

  // ── Header ────────────────────────────────────────────────────────────────

  const header = document.createElement('div');
  header.className = 'app-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'app-header__back';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.textContent = '←';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'app-header__title';
  headerTitle.textContent = template.label + ' — ' + patientLabel;

  const endBtn = document.createElement('button');
  endBtn.className = 'app-header__action';
  endBtn.textContent = 'End';

  header.appendChild(backBtn);
  header.appendChild(headerTitle);
  header.appendChild(endBtn);

  // ── Content ───────────────────────────────────────────────────────────────

  const content = document.createElement('div');
  content.className = 'screen-content';

  const langRow = document.createElement('div');
  langRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:var(--space-4)';

  const langLabel = document.createElement('span');
  langLabel.style.cssText = 'font-size:12px;color:var(--color-text-2);font-weight:500';
  langLabel.textContent = 'Language:';

  const langSelect = document.createElement('select');
  langSelect.setAttribute('aria-label', 'Change patient language');
  langSelect.style.cssText = [
    'background:var(--color-surface-2)',
    'border:1.5px solid var(--color-border)',
    'border-radius:var(--radius-md)',
    'color:var(--color-text-1)',
    'font-family:var(--font-body)',
    'font-size:13px',
    'padding:4px 8px',
    'outline:none',
  ].join(';');

  LANGUAGES.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.label + ' — ' + lang.nativeLabel;
    if (lang.code === languageCode) opt.selected = true;
    langSelect.appendChild(opt);
  });

  langRow.appendChild(langLabel);
  langRow.appendChild(langSelect);
  content.appendChild(langRow);

  const sectionHeading = document.createElement('div');
  sectionHeading.className = 'section-heading';
  content.appendChild(sectionHeading);

  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'font-size:12px;color:var(--color-text-3);margin:var(--space-1) 0 var(--space-2);';
  hintEl.textContent = 'Tap a question to expand · Read aloud · Record patient answer';
  content.appendChild(hintEl);

  const progressEl = document.createElement('div');
  progressEl.className = 'answered-counter';
  progressEl.style.display = 'none';
  content.appendChild(progressEl);

  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'question-list';
  content.appendChild(cardsContainer);

  // ── Custom question bar ───────────────────────────────────────────────────

  const customBar = document.createElement('div');
  customBar.style.cssText = [
    'display:flex',
    'gap:var(--space-2)',
    'padding:var(--space-3) var(--space-4)',
    'padding-bottom:calc(var(--space-3) + env(safe-area-inset-bottom))',
    'background:rgba(10,10,10,0.92)',
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
    'border-top:1px solid var(--color-border)',
    'flex-shrink:0',
  ].join(';');

  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.placeholder = 'Ask something else…';
  customInput.setAttribute('aria-label', 'Type a custom question');
  customInput.style.cssText = [
    'flex:1',
    'background:var(--color-surface-2)',
    'border:1.5px solid var(--color-border)',
    'border-radius:var(--radius-md)',
    'color:var(--color-text-1)',
    'font-family:var(--font-body)',
    'font-size:14px',
    'padding:var(--space-2) var(--space-3)',
    'outline:none',
  ].join(';');

  const sendBtn = document.createElement('button');
  sendBtn.setAttribute('aria-label', 'Send custom question');
  sendBtn.textContent = 'Send';
  sendBtn.style.cssText = [
    'background:var(--color-surface-2)',
    'border:1.5px solid var(--color-border)',
    'border-radius:var(--radius-md)',
    'color:var(--color-primary)',
    'font-family:var(--font-body)',
    'font-size:13px',
    'font-weight:600',
    'padding:var(--space-2) var(--space-4)',
    'cursor:pointer',
    'white-space:nowrap',
    'flex-shrink:0',
  ].join(';');

  customBar.appendChild(customInput);
  customBar.appendChild(sendBtn);

  el.appendChild(header);
  el.appendChild(content);
  el.appendChild(customBar);

  // ── Keyboard avoidance (visualViewport) ───────────────────────────────────
  function onViewportResize() {
    const vv = window.visualViewport;
    if (!vv) return;
    const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
    customBar.style.transform = keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : '';
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
    window.visualViewport.addEventListener('scroll', onViewportResize);
  }

  // Intercept browser back gesture — show exit sheet instead of navigating away
  history.pushState(null, '', location.href);
  function onPopState() {
    history.pushState(null, '', location.href);
    showExitSheet();
  }
  window.addEventListener('popstate', onPopState);

  el.addEventListener('_unmount', () => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewportResize);
      window.visualViewport.removeEventListener('scroll', onViewportResize);
    }
    window.removeEventListener('popstate', onPopState);
  });

  // ── Heading ───────────────────────────────────────────────────────────────

  function updateHeading() {
    const customCount = allCards.filter(c => c.q && c.q.isCustom).length;
    sectionHeading.textContent = 'QUESTIONS (' + (template.questions.length + customCount) + ')';
  }

  function updateProgress() {
    const answered = allCards.filter(c => c.card.classList.contains('answered')).length;
    const total = allCards.length;
    if (total === 0) { progressEl.style.display = 'none'; return; }
    progressEl.style.display = '';
    progressEl.textContent = answered + ' of ' + total + ' answered';
  }

  // ── Build template cards ──────────────────────────────────────────────────

  function buildTemplateCards(translations) {
    clearChildren(cardsContainer);
    allCards.length = 0;
    template.questions.forEach((q, i) => {
      const t = translations ? translations[i] : null;
      const enriched = { ...q, romanised: t ? t.romanised : null, native: t ? t.native : null };
      const { card, expandedContent, chevronEl, updateTranslation } = buildQuestionCard(
        enriched, allCards, handlePlay, handleRecord
      );
      allCards.push({ card, expandedContent, chevronEl, updateTranslation, q: enriched });
      cardsContainer.appendChild(card);
    });
    updateHeading();
    staggerCards(allCards.map(c => c.card));
  }

  buildTemplateCards(null);
  saveSession(session).catch(err => console.error('saveSession:', err));

  // ── Translations ──────────────────────────────────────────────────────────

  async function loadTranslations(langCode, langLabelArg) {
    const langObj = getLanguage(langCode);
    const cacheKey = 'translations_v2:' + templateId + ':' + langCode;
    try {
      const cached = await getCachedTranslations(cacheKey);
      if (cached) { applyTranslations(cached); return; }

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: template.questions.map(q => q.english),
          targetLang: langObj ? langObj.sarvamCode : langCode,
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
      allCards.filter(c => !c.q.isCustom).forEach(c => c.updateTranslation(null, null));
    }
  }

  function applyTranslations(translations) {
    const templateCards = allCards.filter(c => !c.q.isCustom);
    templateCards.forEach((c, i) => {
      if (translations && translations[i]) {
        c.q.native = translations[i].native;
        c.q.romanised = translations[i].romanised;
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

  async function handlePlay(q, btn, orbEl) {
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '…';

    try {
      const langObj = getLanguage(languageCode);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: q.native || q.english, languageCode: langObj ? langObj.sarvamCode : 'hi-IN' }),
        signal,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      btn.style.display = 'none';
      animateOrb(orbEl, 'speaking');


      const audio = new Audio('data:audio/wav;base64,' + data.audio);
      audio.addEventListener('ended', () => {
        animateOrb(orbEl, 'idle');
      btn.style.display = '';
      });
      audio.addEventListener('error', () => {
        animateOrb(orbEl, 'idle');
        btn.style.display = '';
      });
      audio.play().catch(() => {
        animateOrb(orbEl, 'idle');
        btn.style.display = '';
      });
    } catch (err) {
      if (err.name !== 'AbortError') showToast('Could not play audio', 'error');
      btn.style.display = '';
    } finally {
      btn.textContent = origText;
      btn.disabled = false;
    }
  }

  // ── STT — Record ──────────────────────────────────────────────────────────

  async function handleRecord(q, btn, actionsDiv, answerDisplay, answerEnglish, answerOriginal, waveCtrl, orbEl) {
    if (btn.classList.contains('recording')) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      return;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast('Mic access denied — enable it in your browser settings', 'error', 5000);
      return;
    }

    const chunks = [];
    mediaRecorder = new MediaRecorder(activeStream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      btn.classList.remove('recording');
      btn.textContent = 'Record Answer';
      animateOrb(orbEl, 'idle');
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }


      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      const spinner = makeSpinnerEl();
      actionsDiv.appendChild(spinner);
      try {
        const audioBase64 = await blobToBase64(blob);
        const res = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, languageCode, mimeType: blob.type }),
          signal,
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        answerOriginal.textContent = data.original || '';
        answerEnglish.textContent = data.english || '';
        answerDisplay.style.display = '';
        if (waveCtrl.markAnswered) waveCtrl.markAnswered(data.original || data.english || '');
        updateProgress();

        session.qaLog.push({
          questionId: q.id,
          questionEnglish: q.english,
          answerEnglish: data.english || '',
          answerOriginal: data.original || '',
          answerTranscript: data.original || '',
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
    btn.textContent = 'Stop Recording';
    animateOrb(orbEl, 'recording');
  }

  // ── Custom question ───────────────────────────────────────────────────────

  async function submitCustomQuestion() {
    const text = customInput.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    sendBtn.textContent = '…';
    customInput.disabled = true;

    const lang = getLanguage(languageCode);
    const langLabelArg = lang ? lang.label : languageLabel;

    let romanised = null;
    let native = null;

    try {
      const res = await fetch('/api/translate', {
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
      sendBtn.textContent = 'Send';
      sendBtn.disabled = false;
      customInput.disabled = false;
      customInput.value = '';
    }

    const customQ = { id: 'custom-' + Date.now(), english: text, romanised, native, isCustom: true };
    const { card, expandedContent, chevronEl, updateTranslation } = buildQuestionCard(
      customQ, allCards, handlePlay, handleRecord
    );
    allCards.unshift({ card, expandedContent, chevronEl, updateTranslation, q: customQ });
    cardsContainer.insertBefore(card, cardsContainer.firstChild);
    updateTranslation(romanised, native);

    // Auto-expand the custom card
    card.classList.add('expanded');
    expandCard(expandedContent, true);
    if (typeof gsap !== 'undefined') {
      gsap.to(chevronEl, { rotation: 90, duration: 0.2, ease: 'power2.out' });
    }
    updateHeading();
    updateProgress();
    pulseBtn(card);
  }

  sendBtn.addEventListener('click', submitCustomQuestion);
  customInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitCustomQuestion(); });

  // ── End Session ───────────────────────────────────────────────────────────

  async function endSession() {
    session.endedAt = new Date().toISOString();
    session.durationSeconds = Math.round(
      (new Date(session.endedAt) - new Date(session.startedAt)) / 1000
    );
    await saveSession(session);
    navigate('session-summary', { sessionId: session.id }, 'up');
  }

  function showExitSheet() {
    showBottomSheet({
      title: 'End Session?',
      actions: [
        { label: 'Save & Exit', style: 'primary', onClick: endSession },
        { label: 'Discard Session', style: 'destructive', onClick: () => navigate('home', {}, 'back') },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  }

  endBtn.addEventListener('click', showExitSheet);
  backBtn.addEventListener('click', showExitSheet);

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

export function register() {
  registerScreen('session', mountSession);
}
