/**
 * pushNotification.js
 * Sends a push notification via the ShadowTalk signaling server.
 * Safe to call even if the server is unreachable — it fails silently.
 */

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

/**
 * Send a push notification to a user who may be offline.
 * @param {string} recipientId - The user ID of the recipient
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {object} data - Optional extra data payload (all values must be strings)
 */
export async function sendPushNotification(recipientId, title, body, data = {}) {
  if (!recipientId || !title) return;
  try {
    await fetch(`${SIGNALING_URL}/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, title, body, data })
    });
  } catch (err) {
    // Non-critical — don't crash the app if the push server is unreachable
    console.warn('[ShadowTalk] Push notification failed (non-critical):', err.message);
  }
}
