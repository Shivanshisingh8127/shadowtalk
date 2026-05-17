import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';

dotenv.config();

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
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Signaling] Server running on port ${PORT}`);
  console.log(`[Monitoring] Metrics available at http://localhost:${PORT}/metrics`);
});
