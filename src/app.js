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
    // Build DOM safely — no user data is interpolated into innerHTML
    const header = document.createElement('div');
    header.className = 'app-header';
    const headerTitle = document.createElement('div');
    headerTitle.className = 'app-header__title';
    headerTitle.textContent = title;
    header.appendChild(headerTitle);

    const content = document.createElement('div');
    content.className = 'screen-content empty-state';

    const icon = document.createElement('div');
    icon.className = 'empty-state__icon';
    icon.textContent = '🏗️';

    const stateTitle = document.createElement('div');
    stateTitle.className = 'empty-state__title';
    stateTitle.textContent = title;

    const body = document.createElement('div');
    body.className = 'empty-state__body';
    body.textContent = 'Coming in a future task';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary';
    backBtn.style.cssText = 'margin-top:16px;max-width:200px';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => history.back());

    content.appendChild(icon);
    content.appendChild(stateTitle);
    content.appendChild(body);
    content.appendChild(backBtn);

    el.appendChild(header);
    el.appendChild(content);
  };
}

registerScreen('home', placeholderScreen('MedTranslate Home'));
registerScreen('session-setup', placeholderScreen('Session Setup'));
registerScreen('session', placeholderScreen('History Taking'));
registerScreen('session-summary', placeholderScreen('Session Summary'));
registerScreen('past-sessions', placeholderScreen('Past Sessions'));

// Boot to home screen
navigate('home');
