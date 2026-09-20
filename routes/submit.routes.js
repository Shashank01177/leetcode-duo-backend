const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User.model');
const Problem = require('../models/Problem.model');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

// Language slug map: our lang -> LeetCode lang slug
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

// POST /api/submit - Submit code to LeetCode on behalf of user
router.post('/', async (req, res) => {
  try {
    const { code, language = 'python', problemId, sessionId } = req.body;

    // Get user's LeetCode session cookie
    const user = await User.findById(req.user._id);
    if (!user.leetcodeSession) {
      return res.status(400).json({
        success: false,
        message: 'No LeetCode session cookie saved. Go to your profile and add your LEETCODE_SESSION cookie.'
      });
    }

    // Get problem titleSlug and questionId
    const problem = await Problem.findById(problemId);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });

    const titleSlug = problem.titleSlug;
    const questionId = problem.leetcodeQuestionId;

    if (!titleSlug || !questionId) {
      return res.status(400).json({
        success: false,
        message: 'This problem was not imported from LeetCode. Re-import it using the LeetCode slug to enable submission.'
      });
    }

    const langSlug = LANG_MAP[language] || language;

    const lcHeaders = {
      'Content-Type': 'application/json',
      'Referer': `https://leetcode.com/problems/${titleSlug}/`,
      'Cookie': `LEETCODE_SESSION=${user.leetcodeSession}; csrftoken=dummy`,
      'x-csrftoken': 'dummy',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://leetcode.com',
    };

    // Step 1: Get CSRF token
    try {
      const csrfRes = await axios.get(`https://leetcode.com/problems/${titleSlug}/`, {
        headers: { 'Cookie': `LEETCODE_SESSION=${user.leetcodeSession}` },
        timeout: 10000,
      });
      const csrfMatch = csrfRes.headers['set-cookie']?.join('').match(/csrftoken=([^;]+)/);
      if (csrfMatch) {
        lcHeaders['Cookie'] = `LEETCODE_SESSION=${user.leetcodeSession}; csrftoken=${csrfMatch[1]}`;
        lcHeaders['x-csrftoken'] = csrfMatch[1];
      }
    } catch (_) { /* use dummy csrf, might still work */ }

    // Step 2: Submit solution via LeetCode GraphQL
    const submitMutation = {
      query: `mutation submitSolution($titleSlug: String!, $questionId: String!, $lang: String!, $typedCode: String!) {
        submitSolution(input: {
          titleSlug: $titleSlug
          questionId: $questionId
          lang: $lang
          typedCode: $typedCode
        }) { submissionId }
      }`,
      variables: {
        titleSlug,
        questionId: String(questionId),
        lang: langSlug,
        typedCode: code,
      }
    };

    const submitRes = await axios.post('https://leetcode.com/graphql', submitMutation, {
      headers: lcHeaders,
      timeout: 15000,
    });

    const submissionId = submitRes.data?.data?.submitSolution?.submissionId;
    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: 'LeetCode rejected the submission. Your LEETCODE_SESSION cookie may be expired. Please update it in your profile.'
      });
    }

    // Step 3: Poll for result (up to 20 seconds)
    const statusMap = {
      10: 'Accepted', 11: 'Wrong Answer', 12: 'Memory Limit Exceeded',
      13: 'Output Limit Exceeded', 14: 'Time Limit Exceeded',
      15: 'Runtime Error', 16: 'Internal Error', 20: 'Compile Error'
    };

    const detailsQuery = {
      query: `query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          runtime runtimeDisplay runtimePercentile
          memory memoryDisplay memoryPercentile
          statusCode totalCorrect totalTestcases
          runtimeError compileError lastTestcase
        }
      }`,
      variables: { submissionId: parseInt(submissionId) }
    };

    let result = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const detailsRes = await axios.post('https://leetcode.com/graphql', detailsQuery, {
          headers: lcHeaders, timeout: 10000
        });
        const details = detailsRes.data?.data?.submissionDetails;
        if (details && details.statusCode) {
          result = {
            submissionId,
            status: statusMap[details.statusCode] || `Status ${details.statusCode}`,
            statusCode: details.statusCode,
            accepted: details.statusCode === 10,
            runtime: details.runtimeDisplay || details.runtime,
            runtimePercentile: details.runtimePercentile ? Math.round(details.runtimePercentile) : null,
            memory: details.memoryDisplay || details.memory,
            memoryPercentile: details.memoryPercentile ? Math.round(details.memoryPercentile) : null,
            totalCorrect: details.totalCorrect,
            totalTestcases: details.totalTestcases,
            error: details.runtimeError || details.compileError || null,
            lastTestcase: details.lastTestcase || null,
            url: `https://leetcode.com/submissions/detail/${submissionId}/`,
          };
          break;
        }
      } catch (_) { /* polling, keep trying */ }
    }

    if (!result) {
      return res.json({
        success: true,
        data: { submissionId, status: 'Pending', message: 'Submission is still being judged. Check LeetCode directly.', url: `https://leetcode.com/submissions/detail/${submissionId}/` }
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/submit/session - Save user's LeetCode session cookie
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
