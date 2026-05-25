const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Orb — CSS glass ball, state via classes ───────────────────────────────────

export function animateOrb(orbEl, state) {
  if (state === 'idle') {
    gsap.to(orbEl, {
      opacity: 0,
      scale: 0.4,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        orbEl.classList.remove('visible', 'speaking', 'recording');
      },
    });
    return;
  }

  orbEl.classList.remove('speaking', 'recording');
  orbEl.classList.add('visible');

  if (prefersReducedMotion()) {
    gsap.set(orbEl, { opacity: 1, scale: 1 });
    orbEl.classList.add(state);
    return;
  }

  gsap.fromTo(orbEl,
    { opacity: 0, scale: 0.4 },
    { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out',
      onComplete: () => orbEl.classList.add(state) }
  );
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
