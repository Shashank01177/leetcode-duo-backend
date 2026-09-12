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

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

socketHandlers.setup(io);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (used by Railway)
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/leetcode', leetcodeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/session', sessionRoutes);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/leetcode-duo')
  .then(async () => {
    console.log('MongoDB connected');
    
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
      }
    }

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed', err);
  });
