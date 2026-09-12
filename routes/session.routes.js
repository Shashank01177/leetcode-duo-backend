const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const Session = require('../models/Session.model');
const { verifyToken } = require('../middleware/auth.middleware');
const { getAutoMatchState, getNotifyMatch } = require('../socket/socket.handlers');

router.use(verifyToken);

router.post('/queue/join', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isInQueue: true });
    
    if (getAutoMatchState()) {
      const otherUser = await User.findOne({ _id: { $ne: req.user._id }, isInQueue: true });
      if (otherUser) {
        const session = await Session.create({
          userA: req.user._id,
          userB: otherUser._id
        });

        await User.updateMany(
          { _id: { $in: [req.user._id, otherUser._id] } },
          { $set: { currentSessionId: session._id, isInQueue: false } }
        );

        const notifyMatch = getNotifyMatch();
        if (notifyMatch) {
            notifyMatch(req.user._id, otherUser._id, session);
        }
        return res.json({ success: true, message: 'Matched automatically', data: session });
      }
    }

    res.json({ success: true, message: 'Joined queue' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/queue/leave', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isInQueue: false });
    res.json({ success: true, message: 'Left queue' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('userA', '-password')
      .populate('userB', '-password')
      .populate('problem');
      
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/end', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    session.status = 'ended';
    session.endedAt = new Date();
    await session.save();

    await User.updateMany(
      { _id: { $in: [session.userA, session.userB] } },
      { $set: { currentSessionId: null } }
    );

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/code', async (req, res) => {
  try {
    const { code, userRole } = req.body;
    if (userRole !== 'A' && userRole !== 'B') {
      return res.status(400).json({ success: false, message: 'userRole must be A or B' });
    }

    const updateField = userRole === 'A' ? 'codeA' : 'codeB';
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { $set: { [updateField]: code } },
      { new: true }
    );
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
