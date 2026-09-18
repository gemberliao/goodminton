export const PWA_UPDATE_EVENT = 'goodminton-app-update';

export const registerPwa = () => {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;

    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL }).then((registration) => {
      if (registration.waiting) window.dispatchEvent(new Event(PWA_UPDATE_EVENT));

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new Event(PWA_UPDATE_EVENT));
          }
        });
      });
    }).catch((error) => {
      console.warn('GOODMINTON App shell registration failed:', error);
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
};
