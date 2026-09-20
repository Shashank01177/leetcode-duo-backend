const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User.model');
const Session = require('../models/Session.model');
const Problem = require('../models/Problem.model');
const { verifyToken } = require('../middleware/auth.middleware');
const { getAutoMatchState, getNotifyMatch } = require('../socket/socket.handlers');

router.use(verifyToken);


router.post('/queue/join', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isInQueue: true });
    
    if (getAutoMatchState()) {
      const otherUser = await User.findOne({ _id: { $ne: req.user._id }, isInQueue: true });
      if (otherUser) {
        // Auto-assign a random problem
        const problems = await Problem.find({});
        const randomProblem = problems.length > 0
          ? problems[Math.floor(Math.random() * problems.length)]
          : null;

        const session = await Session.create({
          userA: req.user._id,
          userB: otherUser._id,
          problem: randomProblem?._id || null
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

    // Clear both users' session + queue state completely
    await User.updateMany(
      { _id: { $in: [session.userA, session.userB] } },
      { $set: { currentSessionId: null, isInQueue: false } }
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

// Piston language version map
const PISTON_LANGS = {
  python: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'c++', version: '10.2.0' },
  c: { language: 'c', version: '10.2.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.50.0' },
};

// POST /:id/run-code — run user's code against problem test cases via Piston API
router.post('/:id/run-code', async (req, res) => {
  try {
    const { code, language = 'python', problemId } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const lang = PISTON_LANGS[language];
    if (!lang) return res.status(400).json({ success: false, message: `Unsupported language: ${language}` });

    // Get test cases from problem
    const problem = await Problem.findById(problemId);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });

    const testCases = problem.testCases || [];
    if (testCases.length === 0) {
      return res.status(400).json({ success: false, message: 'No test cases available for this problem. Import it from LeetCode to get test cases.' });
    }

    // Run code against each test case using Piston
    const results = await Promise.all(testCases.map(async (tc, idx) => {
      try {
        const pistonRes = await axios.post('https://emkc.org/api/v2/piston/execute', {
          language: lang.language,
          version: lang.version,
          files: [{ name: `solution.${language === 'cpp' ? 'cpp' : language === 'java' ? 'java' : language === 'javascript' ? 'js' : language}`, content: code }],
          stdin: tc.input,
          run_timeout: 5000,
          compile_timeout: 10000,
        }, { timeout: 15000 });

        const run = pistonRes.data.run;
        const actualOutput = (run.stdout || '').trim();
        const expectedOutput = (tc.expected || '').trim();
        const passed = actualOutput === expectedOutput;
        
        return {
          testCase: idx + 1,
          input: tc.input,
          expected: expectedOutput,
          actual: actualOutput,
          passed,
          stderr: run.stderr || '',
          exitCode: run.code,
        };
      } catch (err) {
        return {
          testCase: idx + 1,
          input: tc.input,
          expected: tc.expected,
          actual: '',
          passed: false,
          stderr: err.message,
          exitCode: -1,
        };
      }
    }));

    const passCount = results.filter(r => r.passed).length;
    res.json({
      success: true,
      data: {
        results,
        summary: {
          passed: passCount,
          total: results.length,
          allPassed: passCount === results.length,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
