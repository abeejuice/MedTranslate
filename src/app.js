import { navigate } from './router.js';
import { register as registerHome } from './screens/home.js';
import { register as registerSessionSetup } from './screens/session-setup.js';
import { register as registerSession } from './screens/session.js';
import { register as registerSessionSummary } from './screens/session-summary.js';
import { register as registerPastSessions } from './screens/past-sessions.js';

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(err => {
    console.error('SW registration failed:', err);
  });
}


registerHome();
registerSessionSetup();
registerSession();
registerSessionSummary();
registerPastSessions();

// Boot to home screen
navigate('home');
