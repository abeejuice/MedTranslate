// MedTranslate entry point — router and screen loading added in Task 2
console.log('MedTranslate initialised');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
