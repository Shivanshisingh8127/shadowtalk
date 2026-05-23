import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

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
  const userIdLower = String(userId).toLowerCase();
  userSockets.set(userIdLower, socket.id);
  console.log(`[Signaling] User connected: ${userId} (Socket: ${socket.id})`);

  socket.on('disconnect', () => {
    userSockets.delete(userIdLower);
    console.log(`[Signaling] User disconnected: ${userId}`);
    // If user was in a call, notify the other party
    if (socket.currentCall) {
      const { targetId, callId } = socket.currentCall;
      const targetSocketId = userSockets.get(String(targetId).toLowerCase());
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-ended', { callId, reason: 'remote-disconnect' });
      }
      activeCalls.dec();
    }
  });

  // Initiate Call
  socket.on('call-offer', (data) => {
    const { targetId, type, sdp, callerInfo } = data;
    const targetSocketId = userSockets.get(String(targetId).toLowerCase());
    
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
    const targetSocketId = userSockets.get(String(targetId).toLowerCase());
    
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
    const targetSocketId = userSockets.get(String(targetId).toLowerCase());
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', { candidate, from: userId });
    }
  });

  // End/Decline Call
  socket.on('end-call', (data) => {
    const { targetId, callId, reason } = data;
    const targetSocketId = userSockets.get(String(targetId).toLowerCase());
    
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
    const targetSocketId = userSockets.get(String(targetId).toLowerCase());
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

  // Handle Message Delivered
  socket.on('message_delivered', (data) => {
    try {
      const { messageIds, chatId, senderId, receiverId } = data;
      if (!messageIds || !chatId || !senderId || !receiverId) return;

      console.log(`[Signaling] message_delivered event from receiver ${receiverId} for sender ${senderId} in chat ${chatId}`);

      // Broadcast to sender's active socket
      const senderSocketId = userSockets.get(senderId.toLowerCase());
      if (senderSocketId) {
        console.log(`[Signaling] Forwarding message_delivered event to sender ${senderId}`);
        io.to(senderSocketId).emit('message_delivered', { messageIds, chatId, receiverId });
      }
    } catch (err) {
      console.error('[Signaling] Error in message_delivered handler:', err);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Signaling] Server running on port ${PORT}`);
  console.log(`[Monitoring] Metrics available at http://localhost:${PORT}/metrics`);
});
