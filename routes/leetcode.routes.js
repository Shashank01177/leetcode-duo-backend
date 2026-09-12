const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/:username', verifyToken, async (req, res) => {
  try {
    const { username } = req.params;

    const query = `
      query userPublicProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            ranking
            realName
            userAvatar
            countryName
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;

    const response = await axios.post('https://leetcode.com/graphql', 
      { query, variables: { username } },
      { 
        headers: { 
          'Content-Type': 'application/json', 
          'User-Agent': 'Mozilla/5.0', 
          'Referer': 'https://leetcode.com' 
        } 
      }
    );

    if (response.data.errors || !response.data.data.matchedUser) {
       return res.status(404).json({ success: false, message: 'LeetCode user not found' });
    }

    const user = response.data.data.matchedUser;
    const acStats = user.submitStats?.acSubmissionNum || [];
    const getSolved = (diff) => (acStats.find(s => s.difficulty === diff)?.count || 0);

    const profile = {
      username: user.username,
      realName: user.profile?.realName || '',
      ranking: user.profile?.ranking || 0,
      userAvatar: user.profile?.userAvatar || '',
      countryName: user.profile?.countryName || '',
      easySolved: getSolved('Easy'),
      mediumSolved: getSolved('Medium'),
      hardSolved: getSolved('Hard'),
      totalSolved: getSolved('All'),
    };

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
