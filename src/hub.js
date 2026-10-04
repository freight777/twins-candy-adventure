// The games menu only needs offline support so the home-screen icon works without wifi.
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
