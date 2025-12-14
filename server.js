const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db.js');
const User = require('./models/User.js');

// Track online users
const onlineUsers = new Set();

const authRoutes = require('./routes/authRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const matchRoutes = require('./routes/matchRoutes.js');
const videoRoutes = require('./routes/videoRoutes.js');
const messageRoutes = require('./routes/messageRoutes.js');
const subscriptionRoutes = require('./routes/subscriptionRoutes.js');

dotenv.config();
const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'] }));
app.use(express.json());

connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/subscription', subscriptionRoutes);

const server = http.createServer(app);

// --- Socket.IO signaling for WebRTC (simple-peer) ---
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] },
});
app.set('io', io);

// Store active call timeouts
const callTimeouts = new Map();

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // client registers their app-level userId so we can address them by room = userId
  socket.on('register', ({ userId }) => {
    if (!userId) return;
    socket.join(String(userId));
    socket.userId = String(userId);
    
    // Add to online users and broadcast update
    onlineUsers.add(String(userId));
    console.log(`🟢 userId ${userId} joined room ${userId} (socket ${socket.id})`);
    
    // Emit to all clients that this user is now online
    io.emit('user-connected', String(userId));
    io.emit('users-online', Array.from(onlineUsers));
    
    // Log all current rooms for debugging
    console.log('📊 Current rooms:', Array.from(io.sockets.adapter.rooms.keys()));
    console.log('👥 Online users:', Array.from(onlineUsers));
  });

  // optional: your existing 1:1 chat message event (unchanged)
  socket.on('send-message', async (messageData) => {
    console.log('📨 Broadcasting message:', messageData);
    
    // If the message has a replyTo field, populate it before emitting
    if (messageData.replyTo) {
      try {
        const Message = require('./models/Message');
        const populatedMessage = await Message.findById(messageData._id)
          .populate({
            path: 'replyTo',
            select: 'text sender createdAt',
            populate: {
              path: 'sender',
              select: 'name'
            }
          });
        
        if (populatedMessage) {
          messageData = populatedMessage.toObject();
        }
      } catch (error) {
        console.error('Error populating replyTo in socket handler:', error);
      }
    }
    
    // Broadcast to the receiver
    io.to(String(messageData.receiver)).emit('receive-message', messageData);
  });

  // ---- WebRTC signaling events with subscription check ----
  socket.on('callUser', async ({ to, signal, from, name, isAudioOnly }) => {
    console.log(`📞 Call received: from ${from} to ${to}, audio-only: ${isAudioOnly}, name: ${name}`);
    
    try {
      // Check if caller has active subscription
      const callerUser = await User.findById(from);
      if (!callerUser || !callerUser.hasActiveSubscription()) {
        console.log(`❌ Call blocked: User ${from} doesn't have active subscription`);
        io.to(String(from)).emit('callEnded', { reason: 'subscription_required' });
        return;
      }

      // Check if receiver has active subscription
      const receiverUser = await User.findById(to);
      if (!receiverUser || !receiverUser.hasActiveSubscription()) {
        console.log(`❌ Call blocked: User ${to} doesn't have active subscription`);
        io.to(String(from)).emit('callEnded', { reason: 'receiver_no_subscription' });
        return;
      }

      console.log(`📞 Checking if user ${to} is in room...`);
      
      // Check if the target user is in a room (connected)
      const targetRoom = io.sockets.adapter.rooms.get(String(to));
      if (!targetRoom || targetRoom.size === 0) {
        console.log(`❌ Target user ${to} is not connected or not in room`);
        io.to(String(from)).emit('callEnded', { reason: 'user_offline' });
        return;
      }
      
      console.log(`✅ Target user ${to} found in room with ${targetRoom.size} socket(s)`);
      
      // Clear any existing timeout for this call
      const callKey = `${from}-${to}`;
      if (callTimeouts.has(callKey)) {
        clearTimeout(callTimeouts.get(callKey));
        callTimeouts.delete(callKey);
      }
      
      // Set a 20-second timeout to automatically end the call if not answered
      const timeout = setTimeout(() => {
        console.log(`⏰ Call timeout: Call from ${from} to ${to} was not answered`);
        
        // Notify the caller that the call wasn't answered
        io.to(String(from)).emit('callEnded', { reason: 'not_answered' });
        
        // Notify the callee that the call has ended
        io.to(String(to)).emit('callEnded', { reason: 'not_answered' });
        
        // Clean up the timeout
        callTimeouts.delete(callKey);
      }, 20000); // 20 seconds
      
      callTimeouts.set(callKey, timeout);
      
      console.log(`📞 Delivering call to user ${to}...`);
      // deliver caller's SDP/ICE to callee (addressed by callee's userId room)
      io.to(String(to)).emit('callUser', { signal, from, name, isAudioOnly });
      console.log(`📞 Call delivered to user ${to}`);
    } catch (error) {
      console.error('Call processing error:', error);
      io.to(String(from)).emit('callEnded', { reason: 'server_error' });
    }
  });

  socket.on('answerCall', ({ to, signal, from }) => {
    // Clear the timeout if the call is answered
    const callKey = `${to}-${from}`; // Note: reversed from callUser
    if (callTimeouts.has(callKey)) {
      clearTimeout(callTimeouts.get(callKey));
      callTimeouts.delete(callKey);
    }
    
    // ✅ FIXED: deliver callee's answer back to caller as an object
    io.to(String(to)).emit('callAccepted', { signal });
  });

  socket.on('endCall', ({ to, from }) => {
    // Clear any timeout associated with this call
    if (from && to) {
      const callKey1 = `${from}-${to}`;
      const callKey2 = `${to}-${from}`;
      
      if (callTimeouts.has(callKey1)) {
        clearTimeout(callTimeouts.get(callKey1));
        callTimeouts.delete(callKey1);
      }
      
      if (callTimeouts.has(callKey2)) {
        clearTimeout(callTimeouts.get(callKey2));
        callTimeouts.delete(callKey2);
      }
    }
    
    // politely end on the other side
    io.to(String(to)).emit('callEnded', { reason: 'ended_by_user' });
  });

  // Typing indicators
  socket.on('typing-start', ({ to, userId }) => {
    console.log('✍️ Typing started:', userId, 'to', to);
    io.to(String(to)).emit('typing-start', { userId });
  });

  socket.on('typing-stop', ({ to, userId }) => {
    console.log('✋ Typing stopped:', userId, 'to', to);
    io.to(String(to)).emit('typing-stop', { userId });
  });

  socket.on('disconnect', () => {
    // Clean up any timeouts associated with this socket's calls
    for (const [callKey, timeout] of callTimeouts.entries()) {
      if (callKey.includes(socket.id)) {
        clearTimeout(timeout);
        callTimeouts.delete(callKey);
      }
    }
    
    // Remove from online users if this socket had a registered userId
    if (socket.userId) {
      // Check if user has any other active sockets before removing
      const userRoom = io.sockets.adapter.rooms.get(socket.userId);
      if (!userRoom || userRoom.size === 0) {
        onlineUsers.delete(socket.userId);
        console.log(`🔴 userId ${socket.userId} went offline`);
        
        // Emit to all clients that this user is now offline
        io.emit('user-disconnected', socket.userId);
        io.emit('users-online', Array.from(onlineUsers));
        
        console.log('👥 Online users after disconnect:', Array.from(onlineUsers));
      }
    }
    
    console.log('❌ Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));