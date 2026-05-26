import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

dotenv.config();

// --- Firebase Admin Init ---
const serviceAccount = {
  type: "service_account",
  project_id: "shadowtalk-f916f",
  private_key_id: "70a894917d2590bbf384b86476abfc7f5837ae2f",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDOMVM7vmLzoR67\ne8deNzyecy5Rgew+Pr83GYcTPdgOW/XFu2l0j7lR/vFduqzIJsm3fqPHlqjnQemh\nl3eHalGJIK7YMwp9Vq52jKtHW3GSznbyyPOWVWSmQQdb6oDpwBeJqrmo8ZvL9dSc\nJ7/7vsmuRjtc/K+C8048GKzb1TeTcWYwGh3oI3pWbf+kn5UKRzIvnvBhPzmq3OqH\nLEke3tmzbNknJEWt36REFtx9Hz6f6/I2AkXeGJdO0Daip1AfFpx7WRg+kXF7dtop\nAgu0tGDrc35/BcuyEITzv7ISAn290KZ63Hr8NV/RS48D96YTgR6YZkIYMcCAkVFT\nnPlZxNhrAgMBAAECggEAUUAsnVFDqt9lvdlj0aOQlpuqt+Grl0egj/TWPmXTWq0w\nJw/X2V+9VitRL28dIO3v9QfJQCAFRMO7bbrDFjB2GsQvQfCzBHsA2qRJ5h+JnKER\nTFCVdDsII19ip/y7eeEBJXWKHaG/k9q2QiaDx48B6FOylszX2JFJ1fKfQy087jM+\niwRe/YJxmqsdwXDACSwG/o1lnpsbHlO897LbeVjVbOtPaIE51XdJvj9wZKbAG+UA\nx32S3YVw48xMPXoPM25VD7aacOc8MYheofexixnmYm59BNpGm77ruFZXA26vkdQT\nLHbmrdNlXfZWzKW6NaC7r3oo5mq1yCznkfIbS2Oa6QKBgQD78/QFzu0ajP1BEpgv\nfvvYbhmfELnEFeX2rHicQ9MtPiW2J5urG+amaHa7iHckZKeXzSCouFQSocEW24OZ\nMc3efDWMm/IGDlJrzfaws52B/R5xZo+VuyE9O8KMHUtZv4pY2Ex0eYBX2fJXG6wq\nS0FsqWcoZoJtSvq5Y69xDw8DhwKBgQDRgTPnFyVuk2XvZ9g3cKrwVjCwkTw8UiIr\ndhFt8k7digm+Nz9iSbdqd80RPi3UW/LaTPukO/q3wTM/C5rSKaDh8LWC0VNT03ot\nAbJF+J6NrojDHMVcTCaClCxM4tNczwsVbv69rGjtlaFbU4RnmJkixQ6AUP0W7iY2\nuR9uca3E/QKBgF4+GC78AdCGoExw6iAJ/aYtOMQ4+2OPVV95j/vTmvA3aN/D3QSa\nASKJvK/VEcu5Ir8zaV3y5O+7NYCZR5ZL/NeV2mnoAxWk0culVPsvlGEFDxgX5ul4\n/6vp6JGEe6TscpFdBuwibpFt4qoWncWMNMKycvW3sl2zSCmEUiGWImWNAoGAe3/n\ngb1iQnm/aE5V5fCTw9N7JkqnMIPWQrp58c8Z8HyT276jraP47Fks2JJH39xIH6mr\n2ZfF5xaLyAlmPadugGIuDaypq0uJxQgv+BFkHe8aDbJjIVJ+jREdwEEiCZ6/UOY6\nYsNEo3FGShjEf3E0LIvvTXLwjtjaS/366lc28V0CgYEAqblD83WcSsLyZCq/VaJS\nVOIdnIJTbYoEsZbmCFuq7gV4CxeOlFT9hrlXIBZGmr1Ad7Gfdfc7xvuY79eV2401\nau0cu56ATS/oG5pvjJA+iY8K/6ILG64PhBpPhznvJYdovJT9og18IAvtBsoDKxXU\nsKCLlNAPa3xZ7F4i0CC56WY=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@shadowtalk-f916f.iam.gserviceaccount.com",
  client_id: "103593469942695401298",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40shadowtalk-f916f.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[ShadowTalk] Firebase Admin initialized.');
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, replace with specific origins
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// --- Monitoring Setup ---
const register = new Registry();
collectDefaultMetrics({ register });

const activeCalls = new Gauge({
  name: 'active_calls_total',
  help: 'Total number of active WebRTC calls',
  registers: [register]
});

const callStarts = new Counter({
  name: 'call_starts_total',
  help: 'Total number of initiated calls',
  labelNames: ['type'],
  registers: [register]
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// --- Push Notification Endpoint ---
// Called by the frontend when a message or call is sent to an offline user
app.post('/send-push', async (req, res) => {
  try {
    const { recipientId, title, body, data } = req.body;
    if (!recipientId || !title) {
      return res.status(400).json({ error: 'recipientId and title are required' });
    }

    // Fetch the recipient's FCM token from the chats table
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('chats')
      .select('chat_data')
      .eq('owner_id', recipientId.toLowerCase())
      .eq('chat_id', 'fcm_token')
      .maybeSingle();

    if (tokenErr || !tokenRow?.chat_data?.token) {
      console.warn(`[Push] No FCM token for user ${recipientId}`);
      return res.status(200).json({ sent: false, reason: 'no_token' });
    }

    const fcmToken = tokenRow.chat_data.token;

    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body || 'You have a new notification'
      },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'shadowtalk_notifications'
        }
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        },
        headers: { Urgency: 'high' }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`[Push] Notification sent to ${recipientId}: ${response}`);
    return res.status(200).json({ sent: true, messageId: response });
  } catch (err) {
    console.error('[Push] Error sending notification:', err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Authentication Middleware ---
// Note: This expects the Supabase JWT from the client
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  
  try {
    // Attempt to decode as JWT (Supabase style)
    const decoded = jwt.decode(token);
    if (decoded && decoded.sub) {
      socket.userId = decoded.sub;
    } else {
      // Fallback: Treat token as plain userId (Mock Login style)
      socket.userId = token;
    }
    next();
  } catch (err) {
    // If decoding fails, still try to use token as userId
    socket.userId = token;
    next();
  }
});


// --- Signaling Logic ---
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  const userId = socket.userId;
  userSockets.set(userId, socket.id);
  console.log(`[Signaling] User connected: ${userId} (Socket: ${socket.id})`);

  socket.on('disconnect', () => {
    userSockets.delete(userId);
    console.log(`[Signaling] User disconnected: ${userId}`);
    // If user was in a call, notify the other party
    if (socket.currentCall) {
      const { targetId, callId } = socket.currentCall;
      const targetSocketId = userSockets.get(targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-ended', { callId, reason: 'remote-disconnect' });
      }
      activeCalls.dec();
    }
  });

  // Initiate Call
  socket.on('call-offer', (data) => {
    const { targetId, type, sdp, callerInfo } = data;
    const targetSocketId = userSockets.get(targetId);
    
    console.log(`[Signaling] Call offer from ${userId} to ${targetId} (${type})`);
    callStarts.inc({ type });

    if (!targetSocketId) {
      socket.emit('call-error', { message: 'User is offline' });
      return;
    }

    // Check if target is already in a call (optional logic depending on requirements)
    
    io.to(targetSocketId).emit('incoming-call', {
      from: userId,
      type,
      sdp,
      callerInfo,
      callId: `call_${Date.now()}`
    });
  });

  // Answer Call
  socket.on('call-answer', (data) => {
    const { targetId, sdp, callId } = data;
    const targetSocketId = userSockets.get(targetId);
    
    console.log(`[Signaling] Call answer from ${userId} to ${targetId}`);

    if (targetSocketId) {
      io.to(targetSocketId).emit('call-answered', { sdp, callId });
      
      // Track active call
      socket.currentCall = { targetId, callId };
      const initiatorSocket = io.sockets.sockets.get(targetSocketId);
      if (initiatorSocket) {
        initiatorSocket.currentCall = { targetId: userId, callId };
      }
      activeCalls.inc();
    }
  });

  // ICE Candidate exchange
  socket.on('ice-candidate', (data) => {
    const { targetId, candidate } = data;
    const targetSocketId = userSockets.get(targetId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', { candidate, from: userId });
    }
  });

  // End/Decline Call
  socket.on('end-call', (data) => {
    const { targetId, callId, reason } = data;
    const targetSocketId = userSockets.get(targetId);
    
    console.log(`[Signaling] Call ended by ${userId} (Reason: ${reason})`);

    if (targetSocketId) {
      io.to(targetSocketId).emit('call-ended', { callId, reason });
    }

    // Cleanup local state
    if (socket.currentCall) {
      activeCalls.dec();
      socket.currentCall = null;
    }
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) targetSocket.currentCall = null;
  });

  // Busy Signal
  socket.on('call-busy', (data) => {
    const { targetId } = data;
    const targetSocketId = userSockets.get(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-busy', { from: userId });
    }
  });

  // Handle Message Seen with Backend Validation
  socket.on('message_seen', async (data) => {
    try {
      const { messageIds, chatId, senderId, receiverId } = data;
      if (!messageIds || !chatId || !senderId || !receiverId) return;

      console.log(`[Signaling] message_seen event from receiver ${receiverId} for sender ${senderId} in chat ${chatId}`);

      // Backend Validation: Query settings_privacy row for receiverId in DB
      const { data: settingsRow, error } = await supabase
        .from('chats')
        .select('chat_data')
        .eq('owner_id', receiverId.toLowerCase())
        .eq('chat_id', 'settings_privacy')
        .maybeSingle();

      if (error) {
        console.error(`[Signaling] Error checking privacy settings for ${receiverId}:`, error);
      }

      const readReceiptsEnabled = settingsRow?.chat_data?.readReceipts !== false;
      if (!readReceiptsEnabled) {
        console.warn(`[Signaling] BLOCKED faked message_seen from ${receiverId} (read receipts disabled)`);
        return; // Block faked seen updates!
      }

      // Broadcast to sender's active socket
      const senderSocketId = userSockets.get(senderId.toLowerCase());
      if (senderSocketId) {
        console.log(`[Signaling] Forwarding message_seen event to sender ${senderId}`);
        io.to(senderSocketId).emit('message_seen', { messageIds, chatId, receiverId });
      }
    } catch (err) {
      console.error('[Signaling] Error in message_seen handler:', err);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Signaling] Server running on port ${PORT}`);
  console.log(`[Monitoring] Metrics available at http://localhost:${PORT}/metrics`);
});
