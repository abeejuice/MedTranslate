import { registerScreen, navigate } from '../router.js';
import { saveSession } from '../db.js';
import { LANGUAGES, getLanguage } from '../data/templates.js';
import { showToast } from '../toast.js';
import { animateOrb } from '../animations.js';
import { showBottomSheet } from '../utils.js';

// ── Helpers (mirrored from session.js) ───────────────────────────────────────

function speakWithBrowser(text, langCode) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) return reject(new Error('no speechSynthesis'));
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = langCode;
    utt.onend = resolve;
    utt.onerror = reject;
    window.speechSynthesis.speak(utt);
  });
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getBestMimeType() {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']
    .find(t => t === '' || MediaRecorder.isTypeSupported(t));
}

function makeOrbEl() {
  const wrapper = document.createElement('div');
  wrapper.className = 'orb-wrapper';
  const mask = document.createElement('div');
  mask.className = 'orb-mask';
  for (let i = 1; i <= 4; i++) {
    const blob = document.createElement('div');
    blob.className = `orb-blob orb-blob--${i}`;
    mask.appendChild(blob);
  }
  wrapper.appendChild(mask);
  return wrapper;
}

// ── Log entry DOM builder ────────────────────────────────────────────────────

function buildLogEntry(entry) {
  const div = document.createElement('div');
  div.className = 'opd-log-entry opd-log-entry--' + entry.type;

  const roleChip = document.createElement('div');
  roleChip.className = 'opd-log-entry__role';
  roleChip.textContent = entry.type === 'doctor' ? 'Doctor' : 'Patient';
  div.appendChild(roleChip);

  if (entry.type === 'doctor') {
    const englishEl = document.createElement('div');
    englishEl.className = 'opd-log-entry__english';
    englishEl.textContent = entry.english;
    div.appendChild(englishEl);

    if (entry.native) {
      const nativeEl = document.createElement('div');
      nativeEl.className = 'opd-log-entry__native';
      nativeEl.textContent = entry.native;
      div.appendChild(nativeEl);
    }
  } else {
    if (entry.native) {
      const nativeEl = document.createElement('div');
      nativeEl.className = 'opd-log-entry__native';
      nativeEl.textContent = entry.native;
      div.appendChild(nativeEl);
    }

    if (entry.english) {
      const englishEl = document.createElement('div');
      englishEl.className = 'opd-log-entry__english';
      englishEl.textContent = entry.english;
      div.appendChild(englishEl);
    }
  }

  return div;
}

// ── Mount ────────────────────────────────────────────────────────────────────

async function mountQuickOpd(el) {
  const abortController = new AbortController();
  const { signal } = abortController;

  let mediaRecorder = null;
  let activeStream = null;
  let activeAudio = null;
  let activeEntryEl = null;
  let state = 'idle';
  let langCode = '';
  let langLabel = '';

  const session = {
    id: 'quick-opd-' + Date.now(),
    patientLabel: 'Quick OPD',
    templateId: 'quick-opd',
    templateLabel: 'Quick OPD',
    languageCode: '',
    languageLabel: '',
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationSeconds: 0,
    qaLog: [],
  };

  fetch('/api/log-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'session_start', feature: 'quick_opd', language_code: langCode || null }),
  }).catch(() => {});

  // ── Header ────────────────────────────────────────────────────────────────

  const header = document.createElement('div');
  header.className = 'app-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'app-header__back';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.textContent = '←';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'app-header__title';
  headerTitle.textContent = 'Quick OPD';

  const endBtn = document.createElement('button');
  endBtn.className = 'app-header__action';
  endBtn.textContent = 'End';

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
  header.appendChild(endBtn);
  header.appendChild(galenLogo);

  // ── Body ──────────────────────────────────────────────────────────────────

  const body = document.createElement('div');
  body.className = 'quick-opd-body';

  // Language bar
  const langBar = document.createElement('div');
  langBar.className = 'quick-opd-lang-bar';

  const langBarLabel = document.createElement('span');
  langBarLabel.className = 'quick-opd-lang-bar__label';
  langBarLabel.textContent = 'Patient language:';

  const langSelect = document.createElement('select');
  langSelect.className = 'quick-opd-lang-select';
  langSelect.setAttribute('aria-label', 'Patient language');

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = '— Select language —';
  langSelect.appendChild(placeholderOpt);

  LANGUAGES.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = lang.label + ' — ' + lang.nativeLabel;
    langSelect.appendChild(opt);
  });

  langSelect.addEventListener('change', () => {
    langCode = langSelect.value;
    const lang = getLanguage(langCode);
    langLabel = lang ? lang.label : '';
    session.languageCode = langCode;
    session.languageLabel = langLabel;
  });

  langBar.appendChild(langBarLabel);
  langBar.appendChild(langSelect);
  body.appendChild(langBar);

  // Orb area
  const orbArea = document.createElement('div');
  orbArea.className = 'quick-opd-orb-area';
  const orbEl = makeOrbEl();
  orbArea.appendChild(orbEl);
  body.appendChild(orbArea);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'quick-opd-controls';

  const doctorBtn = document.createElement('button');
  doctorBtn.className = 'btn-mic btn-mic-doctor';
  doctorBtn.setAttribute('aria-label', 'Record doctor speech');

  const doctorIcon = document.createElement('span');
  doctorIcon.className = 'btn-mic__icon';
  doctorIcon.setAttribute('aria-hidden', 'true');
  doctorIcon.textContent = '🎤';
  const doctorBtnText = document.createElement('span');
  doctorBtnText.className = 'btn-mic__label';
  doctorBtnText.textContent = 'Doctor';
  doctorBtn.appendChild(doctorIcon);
  doctorBtn.appendChild(doctorBtnText);

  const patientBtn = document.createElement('button');
  patientBtn.className = 'btn-mic btn-mic-patient';
  patientBtn.setAttribute('aria-label', 'Record patient speech');

  const patientIcon = document.createElement('span');
  patientIcon.className = 'btn-mic__icon';
  patientIcon.setAttribute('aria-hidden', 'true');
  patientIcon.textContent = '🎤';
  const patientBtnText = document.createElement('span');
  patientBtnText.className = 'btn-mic__label';
  patientBtnText.textContent = 'Patient';
  patientBtn.appendChild(patientIcon);
  patientBtn.appendChild(patientBtnText);

  controls.appendChild(doctorBtn);
  controls.appendChild(patientBtn);
  body.appendChild(controls);

  // Conversation log
  const logEl = document.createElement('div');
  logEl.className = 'quick-opd-log';

  const logEmpty = document.createElement('div');
  logEmpty.className = 'quick-opd-log__empty';
  logEmpty.textContent = 'Tap Doctor to start the conversation';
  logEl.appendChild(logEmpty);

  body.appendChild(logEl);

  el.appendChild(header);
  el.appendChild(body);

  // Intercept browser back — show exit sheet
  history.pushState(null, '', location.href);
  function onPopState() {
    history.pushState(null, '', location.href);
    showExitSheet();
  }
  window.addEventListener('popstate', onPopState);

  el.addEventListener('_unmount', () => {
    window.removeEventListener('popstate', onPopState);
  });

  animateOrb(orbEl, 'idle');

  // ── State management ──────────────────────────────────────────────────────

  function setState(newState) {
    state = newState;

    switch (state) {
      case 'idle':
        doctorBtn.disabled = false;
        patientBtn.disabled = false;
        doctorBtnText.textContent = 'Doctor';
        patientBtnText.textContent = 'Patient';
        doctorBtn.classList.remove('recording');
        patientBtn.classList.remove('recording');
        animateOrb(orbEl, 'idle');
        if (activeEntryEl) {
          const playingEl = activeEntryEl.querySelector('.opd-log-entry__playing');
          if (playingEl) playingEl.remove();
        }
        break;
      case 'recording-doctor':
        doctorBtn.disabled = false;
        patientBtn.disabled = true;
        doctorBtnText.textContent = 'Stop';
        doctorBtn.classList.add('recording');
        animateOrb(orbEl, 'recording');
        break;
      case 'recording-patient':
        doctorBtn.disabled = true;
        patientBtn.disabled = false;
        patientBtnText.textContent = 'Stop';
        patientBtn.classList.add('recording');
        animateOrb(orbEl, 'recording');
        break;
      case 'processing':
        doctorBtn.disabled = true;
        patientBtn.disabled = true;
        animateOrb(orbEl, 'processing');
        break;
      case 'playing':
        doctorBtn.disabled = true;
        patientBtn.disabled = true;
        animateOrb(orbEl, 'speaking');
        if (activeEntryEl && !activeEntryEl.querySelector('.opd-log-entry__playing')) {
          const playingEl = document.createElement('div');
          playingEl.className = 'opd-log-entry__playing';
          playingEl.textContent = '▶ Playing to patient…';
          activeEntryEl.appendChild(playingEl);
        }
        break;
    }
  }

  // ── Log management ────────────────────────────────────────────────────────

  function addLogEntry(entry) {
    if (logEmpty.parentNode === logEl) logEl.removeChild(logEmpty);

    if (activeEntryEl) {
      activeEntryEl.classList.remove('opd-log-entry--active');
      const prev = activeEntryEl.querySelector('.opd-log-entry__playing');
      if (prev) prev.remove();
    }

    const entryEl = buildLogEntry(entry);
    logEl.appendChild(entryEl);
    activeEntryEl = entryEl;
    entryEl.classList.add('opd-log-entry--active');

    if (typeof gsap !== 'undefined') {
      gsap.fromTo(entryEl,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out', clearProps: 'transform,opacity' }
      );
    } else {
      entryEl.style.animation = 'opdEntryIn 0.35s cubic-bezier(0.22,1,0.36,1) both';
    }

    logEl.scrollTop = logEl.scrollHeight;

    if (entry.type === 'doctor') {
      session.qaLog.push({
        questionEnglish: entry.english,
        answerOriginal: entry.native || '',
        answerEnglish: entry.native || '',
        askedAt: entry.ts,
      });
    } else {
      session.qaLog.push({
        questionEnglish: 'Patient reply',
        answerOriginal: entry.native || '',
        answerEnglish: entry.english || '',
        askedAt: entry.ts,
      });
    }
    saveSession(session).catch(err => console.error('saveSession:', err));
  }

  // ── Doctor recording ──────────────────────────────────────────────────────

  doctorBtn.addEventListener('click', async () => {
    if (state === 'recording-doctor') {
      navigator.vibrate?.([8, 40, 8]);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      return;
    }

    if (!langCode) {
      showToast('Please select a language first', 'error');
      return;
    }

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast('Mic access denied — enable it in your browser settings', 'error', 5000);
      return;
    }

    const chunks = [];
    const bestMime = getBestMimeType();
    mediaRecorder = new MediaRecorder(activeStream, bestMime ? { mimeType: bestMime } : {});
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      const recordingDurationMs = Date.now() - recordingStartMs;
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      if (blob.size < 1000) { setState('idle'); return; }

      setState('processing');

      // Step 1: transcribe doctor's English speech
      let englishText;
      try {
        const audioBase64 = await blobToBase64(blob);
        console.time('[OPD] STT');
        const res = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, languageCode: 'en', mimeType: blob.type || bestMime || 'audio/webm', feature: 'quick_opd', recordingDurationMs }),
          signal,
        });
        console.timeEnd('[OPD] STT');
        if (!res.ok) throw new Error('STT ' + res.status);
        const data = await res.json();
        englishText = (data.original || data.english || '').trim();
      } catch (err) {
        if (err.name === 'AbortError') { setState('idle'); return; }
        showToast('Could not transcribe speech', 'error');
        setState('idle');
        return;
      }

      if (!englishText) { setState('idle'); return; }

      // Step 2: translate to patient's language
      const lang = getLanguage(langCode);
      const sarvamCode = lang ? lang.sarvamCode : 'hi-IN';
      let native = '';
      let romanised = '';

      try {
        console.time('[OPD] Translate');
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: [englishText], targetLang: langCode, targetLangLabel: langLabel, skipRomanisation: true, feature: 'quick_opd' }),
          signal,
        });
        console.timeEnd('[OPD] Translate');
        if (!res.ok) throw new Error('Translate ' + res.status);
        const data = await res.json();
        native = data.translations?.[0]?.native || '';
        romanised = data.translations?.[0]?.romanised || '';
      } catch (err) {
        if (err.name === 'AbortError') { setState('idle'); return; }
        showToast('Translation unavailable — read the English text to the patient', 'error', 5000);
        addLogEntry({ type: 'doctor', english: englishText, native: '', romanised: '', ts: new Date().toISOString() });
        setState('idle');
        return;
      }

      // Add log entry before playing so doctor can read along
      addLogEntry({ type: 'doctor', english: englishText, native, romanised, ts: new Date().toISOString() });

      // Step 3: play translated audio
      setState('playing');
      const ttsText = native || englishText;

      try {
        console.time('[OPD] TTS');
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: ttsText, languageCode: sarvamCode, feature: 'quick_opd' }),
          signal,
        });
        console.timeEnd('[OPD] TTS');
        if (!res.ok) throw new Error('TTS ' + res.status);
        const data = await res.json();

        await new Promise(resolve => {
          activeAudio = new Audio('data:audio/wav;base64,' + data.audio);
          activeAudio.addEventListener('ended', resolve);
          activeAudio.addEventListener('error', resolve);
          activeAudio.play().catch(resolve);
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          try {
            await speakWithBrowser(ttsText, sarvamCode);
          } catch {
            showToast('Audio unavailable — read the text to the patient', 'error');
          }
        }
      }

      activeAudio = null;
      if (state !== 'idle') setState('idle');
    };

    let recordingStartMs = Date.now();
    mediaRecorder.start(500);
    navigator.vibrate?.(20);
    setState('recording-doctor');
  });

  // ── Patient recording ─────────────────────────────────────────────────────

  patientBtn.addEventListener('click', async () => {
    if (state === 'recording-patient') {
      navigator.vibrate?.([8, 40, 8]);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      return;
    }

    if (!langCode) {
      showToast('Please select a language first', 'error');
      return;
    }

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast('Mic access denied — enable it in your browser settings', 'error', 5000);
      return;
    }

    const chunks = [];
    const bestMime = getBestMimeType();
    mediaRecorder = new MediaRecorder(activeStream, bestMime ? { mimeType: bestMime } : {});
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      const recordingDurationMs = Date.now() - recordingStartMs;
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      if (blob.size < 1000) { setState('idle'); return; }

      setState('processing');

      try {
        const audioBase64 = await blobToBase64(blob);
        console.time('[OPD] STT (patient)');
        const res = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, languageCode: langCode, mimeType: blob.type || bestMime || 'audio/webm', feature: 'quick_opd', recordingDurationMs }),
          signal,
        });
        console.timeEnd('[OPD] STT (patient)');
        if (!res.ok) throw new Error('STT ' + res.status);
        const data = await res.json();

        const nativeText = (data.original || '').trim();
        const englishText = (data.english || '').trim();

        if (!nativeText && !englishText) { setState('idle'); return; }

        setState('idle');
        addLogEntry({ type: 'patient', native: nativeText, english: englishText, ts: new Date().toISOString() });
      } catch (err) {
        if (err.name !== 'AbortError') showToast("Could not transcribe patient's reply", 'error');
        setState('idle');
      }
    };

    let recordingStartMs = Date.now();
    mediaRecorder.start(500);
    navigator.vibrate?.(20);
    setState('recording-patient');
  });

  // ── End session ───────────────────────────────────────────────────────────

  async function saveAndExit() {
    if (session.qaLog.length === 0) {
      navigate('home', {}, 'back');
      return;
    }
    session.endedAt = new Date().toISOString();
    session.durationSeconds = Math.round(
      (new Date(session.endedAt) - new Date(session.startedAt)) / 1000
    );
    fetch('/api/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'session_end',
        feature: 'quick_opd',
        language_code: langCode || null,
        session_duration_seconds: session.durationSeconds,
        qa_count: session.qaLog.length,
      }),
    }).catch(() => {});
    await saveSession(session);
    navigate('home', {}, 'back');
  }

  function showExitSheet() {
    showBottomSheet({
      title: 'End Session?',
      actions: [
        { label: 'Save & Exit', style: 'primary', onClick: saveAndExit },
        { label: 'Discard', style: 'destructive', onClick: () => navigate('home', {}, 'back') },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  }

  endBtn.addEventListener('click', showExitSheet);
  backBtn.addEventListener('click', showExitSheet);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  return () => {
    window.removeEventListener('popstate', onPopState);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    if (activeAudio) { activeAudio.pause(); activeAudio = null; }
    abortController.abort();
    if (session.qaLog.length > 0 && !session.endedAt) {
      session.endedAt = new Date().toISOString();
      session.durationSeconds = Math.round(
        (new Date(session.endedAt) - new Date(session.startedAt)) / 1000
      );
      saveSession(session).catch(() => {});
    }
  };
}

export function register() {
  registerScreen('quick-opd', mountQuickOpd);
}
