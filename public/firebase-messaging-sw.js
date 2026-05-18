importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDIe2XGP_yBqcpuPlTldKogDPSZco1QPpo",
  authDomain: "shadowtalk-f916f.firebaseapp.com",
  projectId: "shadowtalk-f916f",
  storageBucket: "shadowtalk-f916f.firebasestorage.app",
  messagingSenderId: "1050613936240",
  appId: "1:1050613936240:web:c6eddc78ada268f4f044b5",
  measurementId: "G-K2N5039J04"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You received a new message.',
    icon: '/favicon.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);

  // Ping clients to play sound
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'PLAY_SOUND',
        payload: payload
      });
    });
  });
});
