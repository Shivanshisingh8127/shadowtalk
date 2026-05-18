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

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

// Helper to get userId from browser Cache Storage
async function getUserIdFromCache() {
  try {
    const cache = await caches.open('shadowtalk-user');
    const response = await cache.match('/user-id');
    if (response) {
      const text = await response.text();
      return text.trim().toLowerCase();
    }
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Cache read error:', err);
  }
  return null;
}

// Update specific message status in Supabase background
async function markMessageAsDelivered(msgId, userId) {
  try {
    const url = `${supabaseUrl}/rest/v1/messages?id=eq.${encodeURIComponent(msgId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      const msg = data[0];
      const isGroup = msg.chat_id?.toLowerCase()?.startsWith('group_');
      let updatedContent = null;

      if (isGroup) {
        // Group chat message status delivered sync
        const deliveredTo = msg.content?.deliveredTo || [];
        if (!deliveredTo.includes(userId)) {
          deliveredTo.push(userId);
          updatedContent = {
            ...msg.content,
            deliveredTo: deliveredTo
          };
        }
      } else {
        // Direct chat message: change status to 'delivered' if currently 'sent'
        if (msg.content?.status === 'sent') {
          updatedContent = {
            ...msg.content,
            status: 'delivered'
          };
        }
      }

      if (updatedContent) {
        await fetch(url, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ content: updatedContent })
        });
        console.log(`[firebase-messaging-sw.js] Background updated message ${msgId} status successfully.`);
      }
    }
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Error updating message background delivery status:', err);
  }
}

// Background sweep for all pending direct messages
async function sweepPendingDirectMessages(userId) {
  try {
    const url = `${supabaseUrl}/rest/v1/messages?chat_id=eq.${encodeURIComponent(userId)}&content->>status=eq.sent`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const messages = await response.json();
    if (messages && messages.length > 0) {
      console.log(`[firebase-messaging-sw.js] Background sweep found ${messages.length} pending direct messages.`);
      for (const msg of messages) {
        if (msg.sender_id?.toLowerCase() !== userId) {
          const updateUrl = `${supabaseUrl}/rest/v1/messages?id=eq.${encodeURIComponent(msg.id)}`;
          const updatedContent = {
            ...msg.content,
            status: 'delivered'
          };
          await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ content: updatedContent })
          });
        }
      }
      console.log(`[firebase-messaging-sw.js] Background sweep updated all direct messages successfully.`);
    }
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Background sweep error:', err);
  }
}

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You received a new message.',
    icon: '/favicon.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);

  // Background delivery sync
  getUserIdFromCache().then((userId) => {
    if (userId) {
      // 1. If payload contains a specific message ID, update it
      const msgId = payload.data?.messageId || payload.data?.id;
      if (msgId) {
        markMessageAsDelivered(msgId, userId);
      }
      // 2. Run a general sweep to catch any other pending messages
      sweepPendingDirectMessages(userId);
    }
  });

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
