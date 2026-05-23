// Screen router with cleanup protocol and browser back support
const screens = new Map();
let currentScreen = null;
let currentCleanup = null;

export function registerScreen(name, mountFn) {
  screens.set(name, mountFn);
}

export function navigate(name, params = {}) {
  const screenFn = screens.get(name);
  if (!screenFn) { console.error(`Screen "${name}" not registered`); return; }

  // Run previous screen's cleanup (stops timers, audio, streams)
  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  const app = document.getElementById('app');
  app.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'screen';
  app.appendChild(el);

  currentScreen = name;

  // Push history entry for back-button support
  history.pushState({ screen: name, params }, '', `#${name}`);

  // Mount screen — if it returns a function, that's the cleanup
  const result = screenFn(el, params);
  currentCleanup = typeof result === 'function' ? result : null;

  window.scrollTo(0, 0);
}

export function getCurrentScreen() { return currentScreen; }

// Handle browser back/forward button
window.addEventListener('popstate', e => {
  if (e.state?.screen) {
    // Navigate without pushing another history entry
    if (typeof currentCleanup === 'function') {
      currentCleanup();
      currentCleanup = null;
    }
    const app = document.getElementById('app');
    app.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'screen';
    app.appendChild(el);
    currentScreen = e.state.screen;
    const screenFn = screens.get(e.state.screen);
    if (screenFn) {
      const result = screenFn(el, e.state.params || {});
      currentCleanup = typeof result === 'function' ? result : null;
    }
    window.scrollTo(0, 0);
  }
});
