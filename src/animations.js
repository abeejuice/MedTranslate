const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Orb — blob fluid sphere, GSAP-driven ─────────────────────────────────────

const BLOB_IDLE_COLOR_3 = '#EA580C';
const BLOB_RECORD_COLOR_3 = '#FF6EB4';

function killOrbTweens(orbEl) {
  const mask = orbEl.querySelector('.orb-mask');
  const blobs = Array.from(orbEl.querySelectorAll('.orb-blob'));
  gsap.killTweensOf([orbEl, mask, ...blobs]);
}

export function animateOrb(orbEl, state) {
  if (!orbEl) return;
  killOrbTweens(orbEl);

  const blobs = Array.from(orbEl.querySelectorAll('.orb-blob'));
  if (!blobs.length) return;

  if (prefersReducedMotion()) {
    if (state === 'destroy') {
      gsap.set(orbEl, { opacity: 0, scale: 1 });
    } else {
      gsap.set(orbEl, { opacity: state === 'idle' ? 0.85 : 1, scale: 1 });
    }
    return;
  }

  if (state === 'destroy') {
    gsap.to(orbEl, {
      opacity: 0,
      scale: 1,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        killOrbTweens(orbEl);
        gsap.set(blobs[2], { backgroundColor: BLOB_IDLE_COLOR_3 });
      },
    });
    return;
  }

  if (state === 'idle') {
    gsap.to(orbEl, { opacity: 0.85, scale: 1, duration: 0.3, ease: 'power2.out' });
    gsap.set(blobs[2], { backgroundColor: BLOB_IDLE_COLOR_3 });

    // Float the wrapper gently
    gsap.to(orbEl, { y: 4, duration: 3, repeat: -1, yoyo: true, ease: 'sine.inOut' });

    // Each blob drifts independently at slow speed
    const idleParams = [
      { x: 38,  y: -34, dur: 2.8 },
      { x: -40, y:  36, dur: 3.5 },
      { x: -36, y: -38, dur: 3.1 },
      { x:  40, y:  34, dur: 2.6 },
    ];
    blobs.forEach((blob, i) => {
      const p = idleParams[i];
      gsap.to(blob, {
        x: p.x, y: p.y,
        duration: p.dur,
        repeat: -1, yoyo: true,
        ease: 'sine.inOut',
        delay: i * 0.6,
      });
    });
    return;
  }

  if (state === 'speaking') {
    gsap.to(orbEl, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });

    // Wrapper scale pulse after 0.4s ramp
    gsap.to(orbEl, {
      scale: 1.06,
      duration: 0.8,
      repeat: -1, yoyo: true,
      ease: 'sine.inOut',
      delay: 0.4,
    });

    // Blobs faster, larger amplitude
    const speakParams = [
      { x: 35,  y: -30, dur: 1.8 },
      { x: -32, y:  28, dur: 2.3 },
      { x: -28, y: -35, dur: 2.0 },
      { x:  30, y:  25, dur: 1.5 },
    ];
    blobs.forEach((blob, i) => {
      const p = speakParams[i];
      gsap.to(blob, {
        x: p.x, y: p.y,
        duration: p.dur,
        repeat: -1, yoyo: true,
        ease: 'sine.inOut',
        delay: 0.4 + i * 0.1,
      });
    });
    return;
  }

  if (state === 'recording') {
    gsap.to(orbEl, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });

    // Shift blob 3 to coral
    gsap.to(blobs[2], { backgroundColor: BLOB_RECORD_COLOR_3, duration: 0.4 });

    // Wrapper tighter pulse after 0.4s ramp
    gsap.to(orbEl, {
      scale: 1.04,
      duration: 0.6,
      repeat: -1, yoyo: true,
      ease: 'sine.inOut',
      delay: 0.4,
    });

    // Blobs fastest, tighter amplitude
    const recParams = [
      { x: 18,  y: -16, dur: 1.1 },
      { x: -14, y:  18, dur: 1.4 },
      { x: -16, y: -14, dur: 1.2 },
      { x:  15, y:  16, dur: 1.0 },
    ];
    blobs.forEach((blob, i) => {
      const p = recParams[i];
      gsap.to(blob, {
        x: p.x, y: p.y,
        duration: p.dur,
        repeat: -1, yoyo: true,
        ease: 'sine.inOut',
        delay: 0.4 + i * 0.08,
      });
    });
  }
}

// ── Card stagger ──────────────────────────────────────────────────────────────

export function staggerCards(cardEls) {
  if (!cardEls || cardEls.length === 0) return;
  if (prefersReducedMotion()) return;
  gsap.fromTo(cardEls,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: 'power2.out', clearProps: 'transform' }
  );
}

// ── Card expand/collapse ──────────────────────────────────────────────────────

export function expandCard(contentEl, open) {
  if (prefersReducedMotion()) {
    contentEl.style.height = open ? 'auto' : '0px';
    contentEl.style.opacity = open ? '1' : '0';
    return;
  }

  if (open) {
    contentEl.style.height = 'auto';
    const fullH = contentEl.scrollHeight;
    contentEl.style.height = '0px';
    contentEl.style.opacity = '0';
    gsap.to(contentEl, {
      height: fullH,
      opacity: 1,
      duration: 0.22,
      ease: 'power2.out',
      onComplete: () => { contentEl.style.height = 'auto'; },
    });
  } else {
    gsap.to(contentEl, {
      height: 0,
      opacity: 0,
      duration: 0.16,
      ease: 'power2.in',
    });
  }
}

// ── Button pulse ──────────────────────────────────────────────────────────────

export function pulseBtn(el) {
  if (prefersReducedMotion()) return;
  gsap.fromTo(el,
    { scale: 1 },
    { scale: 1.08, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'transform' }
  );
}

// ── Language carousel (GSAP arc, rAF loop) ────────────────────────────────────

export function initLanguageCarousel(wrapNode, onActiveChange) {
  const container = wrapNode.querySelector('.lang-carousel');
  const slides = Array.from(container.querySelectorAll('.lang-pill'));
  const N = slides.length;
  if (!N) return () => {};

  const SLIDE_W    = 140;
  const SLIDE_H    = 72;
  const SLIDE_GAP  = 155;  // center-to-center horizontal spacing
  const ARC_DEPTH  = 35;   // px pills drop at edges
  const CENTER_LIFT = 10;  // extra lift for center pill
  const LERP  = 0.08;
  const TRACK = N * SLIDE_GAP;

  let scrollTarget  = 0;
  let scrollCurrent = 0;
  let wrapW = 0, centerX = 0, baselineY = 0;
  let activeIndex = -1;
  let raf;

  function measure() {
    wrapW     = wrapNode.clientWidth;
    centerX   = wrapW / 2;
    baselineY = (wrapNode.clientHeight || 160) * 0.45;
  }
  measure();

  function layout() {
    let closestDist = Infinity, closestIdx = 0;

    slides.forEach((slide, i) => {
      let offset = (i * SLIDE_GAP - scrollCurrent) % TRACK;
      if (offset < 0) offset += TRACK;
      if (offset > TRACK / 2) offset -= TRACK;

      const normDist = Math.min(Math.abs(offset) / (wrapW * 0.5), 1.3);
      const scale    = Math.max(1.08 - normDist * 0.25, 0.85);
      const opacity  = Math.max(1 - normDist * 0.8, 0.45);
      const arcDrop  = (1 - Math.cos(normDist * Math.PI)) * 0.5 * ARC_DEPTH;
      const lift     = Math.max(1 - normDist * 2, 0) * CENTER_LIFT;
      const x        = centerX + offset - SLIDE_W / 2;
      const y        = baselineY + arcDrop - lift - SLIDE_H / 2;
      const zIndex   = Math.round(100 - normDist * 100);

      gsap.set(slide, { x, y, scale, opacity, zIndex });

      if (Math.abs(offset) < closestDist) {
        closestDist = Math.abs(offset);
        closestIdx  = i;
      }
    });

    if (closestIdx !== activeIndex) {
      if (activeIndex >= 0) slides[activeIndex].classList.remove('active');
      activeIndex = closestIdx;
      slides[activeIndex].classList.add('active');
      onActiveChange?.(slides[activeIndex].dataset.code, slides[activeIndex].dataset.label);
      navigator.vibrate?.(30);
    }
  }

  function tick() {
    scrollCurrent += (scrollTarget - scrollCurrent) * LERP;
    layout();
    raf = requestAnimationFrame(tick);
  }

  let isDragging = false, startX = 0;

  function dragStart(e) {
    isDragging = true;
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.pageX;
  }
  function dragMove(e) {
    if (!isDragging) return;
    const cx = e.type.includes('touch') ? e.touches[0].clientX : e.pageX;
    scrollTarget += (startX - cx) * 1.5;
    startX = cx;
  }
  function dragEnd() { isDragging = false; }

  container.addEventListener('mousedown',  dragStart);
  container.addEventListener('touchstart', dragStart, { passive: true });
  window.addEventListener('mousemove', dragMove);
  window.addEventListener('mouseup',   dragEnd);
  container.addEventListener('touchmove', dragMove, { passive: true });
  container.addEventListener('touchend',  dragEnd);
  container.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      scrollTarget += e.deltaX * 0.8;
    }
  }, { passive: false });

  window.addEventListener('resize', measure);
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize',    measure);
    window.removeEventListener('mousemove', dragMove);
    window.removeEventListener('mouseup',   dragEnd);
  };
}
