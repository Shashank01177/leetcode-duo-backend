const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User.model');
const Problem = require('../models/Problem.model');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

const LANG_MAP = {
  python: 'python3',
  javascript: 'javascript',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  go: 'golang',
  rust: 'rust',
  typescript: 'typescript',
};

const STATUS_MAP = {
  10: 'Accepted', 11: 'Wrong Answer', 12: 'Memory Limit Exceeded',
  13: 'Output Limit Exceeded', 14: 'Time Limit Exceeded',
  15: 'Runtime Error', 16: 'Internal Error', 20: 'Compile Error'
};

// POST /api/submit
router.post('/', async (req, res) => {
  try {
    const { code, language = 'python', problemId } = req.body;

    // 1. Get user's LeetCode session cookie
    const user = await User.findById(req.user._id);
    if (!user || !user.leetcodeSession) {
      return res.status(400).json({
        success: false,
        message: 'No LeetCode session cookie saved. Go to your Profile page and paste your LEETCODE_SESSION cookie first.'
      });
    }

    // 2. Get problem info
    const problem = await Problem.findById(problemId);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });

    const { titleSlug, leetcodeQuestionId: questionId } = problem;
    if (!titleSlug || !questionId) {
      return res.status(400).json({
        success: false,
        message: 'This problem was not imported from LeetCode. Re-import it using a LeetCode slug to enable submission.'
      });
    }

    const langSlug = LANG_MAP[language] || language;

    // 3. Get CSRF token by visiting leetcode.com
    let csrfToken = '';
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    try {
      const homeRes = await axios.get('https://leetcode.com/', {
        headers: {
          'Cookie': `LEETCODE_SESSION=${user.leetcodeSession}`,
          'User-Agent': UA,
        },
        timeout: 8000,
        maxRedirects: 3,
      });
      const setCookies = (homeRes.headers['set-cookie'] || []).join(';');
      const match = setCookies.match(/csrftoken=([^;]+)/);
      if (match) csrfToken = match[1];
    } catch (_) {}

    // Fall back: try extracting csrf from the session cookie itself
    if (!csrfToken) {
      try {
        const csrfRes = await axios.get(`https://leetcode.com/graphql`, {
          headers: { 'Cookie': `LEETCODE_SESSION=${user.leetcodeSession}`, 'User-Agent': UA },
          timeout: 5000,
        });
        const setCookies = (csrfRes.headers['set-cookie'] || []).join(';');
        const match = setCookies.match(/csrftoken=([^;]+)/);
        if (match) csrfToken = match[1];
      } catch (_) {}
    }

    if (!csrfToken) csrfToken = 'lc_csrf_dummy';

    const lcHeaders = {
      'Content-Type': 'application/json',
      'Cookie': `LEETCODE_SESSION=${user.leetcodeSession}; csrftoken=${csrfToken}`,
      'X-CSRFToken': csrfToken,
      'Referer': `https://leetcode.com/problems/${titleSlug}/`,
      'Origin': 'https://leetcode.com',
      'User-Agent': UA,
    };

    // 4. Submit via LeetCode REST API (not GraphQL)
    let submissionId;
    try {
      const submitRes = await axios.post(
        `https://leetcode.com/problems/${titleSlug}/submit/`,
        {
          lang: langSlug,
          question_id: parseInt(questionId),
          typed_code: code,
        },
        { headers: lcHeaders, timeout: 15000 }
      );
      submissionId = submitRes.data?.submission_id;
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data;
      if (status === 401 || status === 403) {
        return res.status(400).json({
          success: false,
          message: 'LeetCode rejected your session (401/403). Your LEETCODE_SESSION cookie is expired or invalid. Please update it in your Profile page.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `LeetCode submission failed (${status}). Make sure your LEETCODE_SESSION cookie is fresh. Error: ${JSON.stringify(msg)?.substring(0, 200)}`
      });
    }

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: 'LeetCode did not return a submission ID. Your session cookie may be expired.'
      });
    }

    // 5. Poll for result
    let result = null;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const checkRes = await axios.get(
          `https://leetcode.com/submissions/detail/${submissionId}/check/`,
          { headers: lcHeaders, timeout: 10000 }
        );
        const d = checkRes.data;
        if (d.state === 'SUCCESS' || (d.status_code && d.status_code !== 0)) {
          result = {
            submissionId,
            status: d.status_msg || STATUS_MAP[d.status_code] || `Status ${d.status_code}`,
            statusCode: d.status_code,
            accepted: d.status_code === 10,
            runtimeDisplay: d.status_runtime || d.runtime,
            runtimePercentile: d.runtime_percentile ? Math.round(d.runtime_percentile) : null,
            memoryDisplay: d.memory,
            memoryPercentile: d.memory_percentile ? Math.round(d.memory_percentile) : null,
            totalCorrect: d.total_correct,
            totalTestcases: d.total_testcases,
            error: d.compile_error || d.runtime_error || null,
            lastTestcase: d.last_testcase || null,
          };
          break;
        }
      } catch (_) {}
    }

    if (!result) {
      return res.json({
        success: true,
        data: { submissionId, status: 'Pending', message: 'Still judging. Check LeetCode directly.' }
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/submit/session - Save LEETCODE_SESSION cookie
router.put('/session', async (req, res) => {
  try {
    const { leetcodeSession } = req.body;
    if (!leetcodeSession) return res.status(400).json({ success: false, message: 'Session cookie required' });
    await User.findByIdAndUpdate(req.user._id, { leetcodeSession });
    res.json({ success: true, message: 'LeetCode session saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/submit/session - Check if session is saved
router.get('/session', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: { hasSession: !!user.leetcodeSession } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
