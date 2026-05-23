import { navigate, registerScreen } from './router.js';

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(err => {
    console.error('SW registration failed:', err);
  });
}

// Placeholder screens until Tasks 6-8 fill them in
function placeholderScreen(title) {
  return (el) => {
    el.innerHTML = `
      <div class="app-header">
        <div class="app-header__title">${title}</div>
      </div>
      <div class="screen-content empty-state">
        <div class="empty-state__icon">🏗️</div>
        <div class="empty-state__title">${title}</div>
        <div class="empty-state__body">Coming in a future task</div>
        <button class="btn btn-primary" style="margin-top:16px;max-width:200px" onclick="history.back()">Back</button>
      </div>
    `;
  };
}

registerScreen('home', placeholderScreen('MedTranslate Home'));
registerScreen('session-setup', placeholderScreen('Session Setup'));
registerScreen('session', placeholderScreen('History Taking'));
registerScreen('session-summary', placeholderScreen('Session Summary'));
registerScreen('past-sessions', placeholderScreen('Past Sessions'));

// Boot to home screen
navigate('home');
