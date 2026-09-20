require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const User = require('./models/User.model');
const socketHandlers = require('./socket/socket.handlers');

const authRoutes = require('./routes/auth.routes');
const leetcodeRoutes = require('./routes/leetcode.routes');
const adminRoutes = require('./routes/admin.routes');
const sessionRoutes = require('./routes/session.routes');
const submitRoutes = require('./routes/submit.routes');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://leetcode-duo-frontend.vercel.app',
];

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, true),
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

socketHandlers.setup(io);

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check — always responds so Render knows we're alive
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/leetcode', leetcodeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/submit', submitRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

const PORT = process.env.PORT || 5000;

// START SERVER IMMEDIATELY — don't wait for DB
// Render requires the port to be bound quickly or it kills the process
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect to MongoDB in the background
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/leetcode-duo', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected');

    // Seed admin user after DB connects
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      const adminExists = await User.findOne({ email: adminEmail });
      if (!adminExists) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);
        await User.create({
          name: 'Admin',
          phone: '0000000000',
          email: adminEmail,
          password: hashedPassword,
          leetcodeId: 'admin_leetcode_duo',
          role: 'admin'
        });
        console.log('Admin user created');
      } else {
        console.log('Admin already exists');
      }
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Don't exit — keep server running so health check passes
    // Retry after 10 seconds
    setTimeout(connectDB, 10000);
  }
};

connectDB();
