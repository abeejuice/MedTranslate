// Simple hash-based screen router
// Screens register themselves; router shows/hides on hash change

const screens = new Map();
let currentScreen = null;

export function registerScreen(name, mountFn) {
  screens.set(name, mountFn);
}

export function navigate(name, params = {}) {
  const screenFn = screens.get(name);
  if (!screenFn) { console.error(`Screen "${name}" not registered`); return; }

  const app = document.getElementById('app');
  app.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'screen';
  app.appendChild(el);

  currentScreen = name;
  screenFn(el, params);

  // Scroll to top on navigation
  window.scrollTo(0, 0);
}

export function getCurrentScreen() { return currentScreen; }
