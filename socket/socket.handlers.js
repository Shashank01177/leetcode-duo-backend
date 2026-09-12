const jwt = require('jsonwebtoken');

let autoMatchEnabled = false;
const connectedUsers = {};
let ioInstance = null;

const getAutoMatchState = () => autoMatchEnabled;
const setAutoMatchState = (state) => { autoMatchEnabled = state; };

const notifyMatch = (userAId, userBId, session) => {
  const socketAId = connectedUsers[userAId];
  const socketBId = connectedUsers[userBId];
  
  if (socketAId && ioInstance) {
    ioInstance.to(socketAId).emit('match-found', { session });
  }
  if (socketBId && ioInstance) {
    ioInstance.to(socketBId).emit('match-found', { session });
  }
};

const getNotifyMatch = () => notifyMatch;

module.exports = {
  getAutoMatchState,
  setAutoMatchState,
  getNotifyMatch,
  setup: (io) => {
    ioInstance = io;
    io.on('connection', (socket) => {
      let currentUserId = null;

      socket.on('authenticate', async ({ token }) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          currentUserId = decoded.id;
          connectedUsers[currentUserId] = socket.id;
          socket.emit('authenticated', { success: true });
        } catch (err) {
          socket.emit('unauthorized', { message: 'Invalid token' });
        }
      });

      socket.on('join-session', ({ sessionId }) => {
        socket.join(sessionId);
      });

      socket.on('code-change', ({ sessionId, code, userRole }) => {
        socket.to(sessionId).emit('code-updated', { code, userRole });
      });

      socket.on('webrtc-offer', ({ sessionId, offer }) => {
        socket.to(sessionId).emit('webrtc-offer', { offer });
      });
      
      socket.on('webrtc-answer', ({ sessionId, answer }) => {
        socket.to(sessionId).emit('webrtc-answer', { answer });
      });
      
      socket.on('webrtc-ice-candidate', ({ sessionId, candidate }) => {
        socket.to(sessionId).emit('webrtc-ice-candidate', { candidate });
      });
      
      socket.on('speaking-state', ({ sessionId, isSpeaking }) => {
        socket.to(sessionId).emit('peer-speaking', { isSpeaking });
      });

      socket.on('disconnect', () => {
        if (currentUserId) {
          delete connectedUsers[currentUserId];
        }
      });
    });
  }
};
