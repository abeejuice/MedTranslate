// Screen router with GSAP transitions and cleanup protocol
const screens = new Map();
let currentScreen = null;
let currentCleanup = null;
let currentEl = null;

export function registerScreen(name, mountFn) {
  screens.set(name, mountFn);
}

const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function transitionScreens(outEl, inEl, direction, onComplete) {
  if (!outEl || prefersReduced()) {
    if (outEl) outEl.remove();
    onComplete();
    return;
  }

  const dur = 0.28;
  const ease = 'power2.inOut';

  const inFrom = {};
  const outTo = {};

  if (direction === 'up') {
    inFrom.y = '100%'; outTo.y = '-20%';
  } else if (direction === 'back') {
    inFrom.x = '-100%'; outTo.x = '100%';
  } else {
    inFrom.x = '100%'; outTo.x = '-30%';
  }

  gsap.set(inEl, inFrom);

  const tl = gsap.timeline({ onComplete });
  tl.to(outEl, { ...outTo, duration: dur, ease })
    .fromTo(inEl, inFrom, { x: 0, y: 0, duration: dur, ease }, '<');
  tl.then(() => { if (outEl.parentNode) outEl.remove(); });
}

export function navigate(name, params = {}, direction = 'forward') {
  const screenFn = screens.get(name);
  if (!screenFn) { console.error(`Screen "${name}" not registered`); return; }

  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  const app = document.getElementById('app');
  const outEl = currentEl;

  if (!outEl) {
    while (app.firstChild) app.removeChild(app.firstChild);
  }

  const inEl = document.createElement('div');
  inEl.className = 'screen';
  app.appendChild(inEl);
  currentEl = inEl;
  currentScreen = name;

  history.pushState({ screen: name, params, direction }, '', `#${name}`);

  const result = screenFn(inEl, params);
  currentCleanup = typeof result === 'function' ? result : null;

  transitionScreens(outEl, inEl, direction, () => { window.scrollTo(0, 0); });
}

export function getCurrentScreen() { return currentScreen; }

window.addEventListener('popstate', e => {
  if (!e.state?.screen) return;

  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  const app = document.getElementById('app');
  const outEl = currentEl;

  const inEl = document.createElement('div');
  inEl.className = 'screen';
  app.appendChild(inEl);
  currentEl = inEl;
  currentScreen = e.state.screen;

  const screenFn = screens.get(e.state.screen);
  if (screenFn) {
    const result = screenFn(inEl, e.state.params || {});
    currentCleanup = typeof result === 'function' ? result : null;
  }

  transitionScreens(outEl, inEl, 'back', () => { window.scrollTo(0, 0); });
});
