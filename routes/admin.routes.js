const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const Session = require('../models/Session.model');
const Problem = require('../models/Problem.model');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const seedProblemsData = require('../utils/seedProblems');
const { getAutoMatchState, setAutoMatchState, getNotifyMatch } = require('../socket/socket.handlers');

router.use(verifyToken, requireAdmin);

router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/queue', async (req, res) => {
  try {
    const users = await User.find({ isInQueue: true }).select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/match', async (req, res) => {
  try {
    const { userAId, userBId, problemId } = req.body;
    
    if (!userAId || !userBId) {
      return res.status(400).json({ success: false, message: 'Please provide userAId and userBId' });
    }

    // Auto-assign a random problem if none specified
    let assignedProblem = problemId || null;
    if (!assignedProblem) {
      const problems = await Problem.find({});
      if (problems.length > 0) {
        assignedProblem = problems[Math.floor(Math.random() * problems.length)]._id;
      }
    }

    const session = await Session.create({
      userA: userAId,
      userB: userBId,
      problem: assignedProblem
    });

    await User.updateMany(
      { _id: { $in: [userAId, userBId] } },
      { $set: { currentSessionId: session._id, isInQueue: false } }
    );

    const notifyMatch = getNotifyMatch();
    if (notifyMatch) {
       notifyMatch(userAId, userBId, session);
    }

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/automatch', (req, res) => {
  res.json({ success: true, data: { enabled: getAutoMatchState() } });
});

router.put('/automatch', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'enabled must be a boolean' });
  }
  setAutoMatchState(enabled);
  res.json({ success: true, data: { enabled: getAutoMatchState() } });
});

router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find({})
      .populate('userA', '-password')
      .populate('userB', '-password')
      .populate('problem');
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/problems', async (req, res) => {
  try {
    const problems = await Problem.find({});
    res.json({ success: true, data: problems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/problems', async (req, res) => {
  try {
    const problem = await Problem.create(req.body);
    res.status(201).json({ success: true, data: problem });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/problems/:id', async (req, res) => {
  try {
    const problem = await Problem.findByIdAndDelete(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }
    res.json({ success: true, message: 'Problem deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/seed-problems', async (req, res) => {
  try {
    await Problem.deleteMany({});
    const problems = await Problem.insertMany(seedProblemsData);
    res.status(201).json({ success: true, data: problems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear ALL stale queue states — call this to reset stuck users
router.post('/reset-queue', async (req, res) => {
  try {
    await User.updateMany({}, { $set: { isInQueue: false } });
    res.json({ success: true, message: 'All queue states cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign problem to an existing session
router.put('/sessions/:id/problem', async (req, res) => {
  try {
    const { problemId } = req.body;
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { problem: problemId },
      { new: true }
    ).populate('problem');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
