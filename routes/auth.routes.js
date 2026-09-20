const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User.model');
const { verifyToken } = require('../middleware/auth.middleware');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), name: user.name, phone: user.phone, leetcodeId: user.leetcodeId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, leetcodeId } = req.body;

    if (!name || !phone || !password || !leetcodeId) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ $or: [{ phone }, { leetcodeId }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this phone or LeetCode ID already exists' });
    }

    // Soft-validate LeetCode ID — only reject if LeetCode explicitly says user doesn't exist.
    // If API is unreachable / rate-limited, we allow registration to proceed.
    try {
      const graphqlQuery = {
        query: `query userPublicProfile($username: String!) { matchedUser(username: $username) { username } }`,
        variables: { username: leetcodeId }
      };
      const response = await axios.post('https://leetcode.com/graphql', graphqlQuery, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://leetcode.com',
        },
        timeout: 8000, // 8-second timeout so it doesn't hang forever
      });
      // Only block if LeetCode explicitly returns null for the user
      if (response.data?.data && response.data.data.matchedUser === null) {
        return res.status(400).json({ success: false, message: `LeetCode user "${leetcodeId}" not found. Please check your username.` });
      }
    } catch (err) {
      // API unreachable, rate-limited, or timed out — allow registration anyway
      console.warn('[LeetCode validation] Could not reach LeetCode API, skipping validation:', err.message);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      phone,
      password: hashedPassword,
      leetcodeId
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user.id,
          name: user.name,
          phone: user.phone,
          leetcodeId: user.leetcodeId,
          role: user.role,
          token: generateToken(user)
        }
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        success: true,
        data: {
          _id: user.id,
          name: user.name,
          phone: user.phone,
          leetcodeId: user.leetcodeId,
          role: user.role,
          token: generateToken(user)
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid phone or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const User = require('../models/User.model');
    const user = await User.findById(req.user._id).select('-password -leetcodeSession');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/logout', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
