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
      { x: 52,  y: -44, dur: 2.8 },
      { x: -55, y:  40, dur: 3.5 },
      { x: -48, y: -52, dur: 3.1 },
      { x:  55, y:  38, dur: 2.6 },
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
