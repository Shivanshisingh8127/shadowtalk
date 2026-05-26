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

      if (isGroup) {
        // Group chat message status delivered sync using RPC
        const rpcUrl = `${supabaseUrl}/rest/v1/rpc/append_message_status`;
        await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            msg_id: msgId,
            user_id: userId,
            status_type: 'delivered'
          })
        });
        console.log(`[firebase-messaging-sw.js] Background updated group message ${msgId} status to delivered.`);
      } else {
        // Direct chat message: change status to 'delivered' if currently 'sent'
        if (msg.content?.status === 'sent') {
          const updatedContent = {
            ...msg.content,
            status: 'delivered'
          };
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
          console.log(`[firebase-messaging-sw.js] Background updated message ${msgId} status to delivered.`);
        }
      }
    }
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Error updating message background delivery status:', err);
  }
}

// Background sweep for all pending direct and group messages
async function sweepPendingMessages(userId) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // 1. Sweep Direct Messages
    const directUrl = `${supabaseUrl}/rest/v1/messages?chat_id=eq.${encodeURIComponent(userId)}&content->>status=eq.sent&created_at=gt.${sevenDaysAgo}`;
    const directResponse = await fetch(directUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const directMessages = await directResponse.json();
    if (directMessages && directMessages.length > 0) {
      console.log(`[firebase-messaging-sw.js] Sweep found ${directMessages.length} pending direct messages.`);
      for (const msg of directMessages) {
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
    }

    // 2. Sweep Group Messages
    // Fetch group chats the user is part of
    const chatsUrl = `${supabaseUrl}/rest/v1/chats?owner_id=eq.${encodeURIComponent(userId)}&chat_id=like.group_*`;
    const chatsResponse = await fetch(chatsUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const groupChats = await chatsResponse.json();
    if (groupChats && groupChats.length > 0) {
      const groupIds = groupChats.map(c => c.chat_id);
      const groupIdsStr = groupIds.map(id => `"${id}"`).join(',');
      
      // Fetch messages for these groups in the last 7 days
      const groupMsgsUrl = `${supabaseUrl}/rest/v1/messages?chat_id=in.(${encodeURIComponent(groupIdsStr)})&created_at=gt.${sevenDaysAgo}`;
      const groupMsgsResponse = await fetch(groupMsgsUrl, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      const groupMessages = await groupMsgsResponse.json();
      if (groupMessages && groupMessages.length > 0) {
        console.log(`[firebase-messaging-sw.js] Sweep found ${groupMessages.length} group messages in user's groups.`);
        for (const msg of groupMessages) {
          if (msg.sender_id?.toLowerCase() !== userId) {
            const content = msg.content || {};
            const deliveredTo = content.deliveredTo || [];
            const seenBy = content.seenBy || [];
            if (!deliveredTo.includes(userId) && !seenBy.includes(userId)) {
              // Call RPC to append status
              const rpcUrl = `${supabaseUrl}/rest/v1/rpc/append_message_status`;
              await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  msg_id: msg.id,
                  user_id: userId,
                  status_type: 'delivered'
                })
              });
            }
          }
        }
      }
    }
    console.log(`[firebase-messaging-sw.js] Background sweep finished successfully.`);
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Background sweep error:', err);
  }
}

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // If the payload already has a notification, FCM SDK handles it automatically.
  // We only show it manually if it's a data-only payload to prevent duplicates,
  // OR if we explicitly want to show it.
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You received a new message.',
    icon: '/icon-192.png'
  };

  const notificationPromise = self.registration.showNotification(notificationTitle, notificationOptions);

  // Background delivery sync
  const syncPromise = getUserIdFromCache().then((userId) => {
    if (userId) {
      // 1. If payload contains a specific message ID, update it
      const msgId = payload.data?.messageId || payload.data?.id;
      if (msgId) {
        markMessageAsDelivered(msgId, userId);
      }
      // 2. Run a general sweep to catch any other pending messages
      return sweepPendingMessages(userId);
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

  // Return the promise chain to keep the service worker alive until finished
  return Promise.all([notificationPromise, syncPromise]);
});
