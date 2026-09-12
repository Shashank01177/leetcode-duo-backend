module.exports = [
  {
    title: "Two Sum",
    difficulty: "Easy",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]." }
    ],
    constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9", "Only one valid answer exists."],
    dataStructure: "Arrays & Strings"
  },
  {
    title: "Reverse Linked List",
    difficulty: "Easy",
    description: "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    examples: [
      { input: "head = [1,2,3,4,5]", output: "[5,4,3,2,1]", explanation: "The linked list is reversed." }
    ],
    constraints: ["The number of nodes in the list is the range [0, 5000].", "-5000 <= Node.val <= 5000"],
    dataStructure: "Linked Lists"
  },
  {
    title: "Valid Parentheses",
    difficulty: "Easy",
    description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    examples: [
      { input: "s = '()[]{}'", output: "true", explanation: "All brackets are properly closed." }
    ],
    constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."],
    dataStructure: "Stacks & Queues"
  },
  {
    title: "Maximum Depth of Binary Tree",
    difficulty: "Easy",
    description: "Given the root of a binary tree, return its maximum depth.",
    examples: [
      { input: "root = [3,9,20,null,null,15,7]", output: "3", explanation: "The longest path has 3 nodes." }
    ],
    constraints: ["The number of nodes in the tree is in the range [0, 10^4].", "-100 <= Node.val <= 100"],
    dataStructure: "Trees & Graphs"
  },
  {
    title: "Climbing Stairs",
    difficulty: "Easy",
    description: "You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    examples: [
      { input: "n = 2", output: "2", explanation: "1 step + 1 step, or 2 steps." }
    ],
    constraints: ["1 <= n <= 45"],
    dataStructure: "Dynamic Programming"
  },
  {
    title: "Two Sum HashMap",
    difficulty: "Easy",
    description: "Use a hash map to solve Two Sum in O(n) time.",
    examples: [
      { input: "nums = [3,2,4], target = 6", output: "[1,2]", explanation: "nums[1] + nums[2] == 6." }
    ],
    constraints: ["2 <= nums.length <= 10^4"],
    dataStructure: "Hashing"
  },
  {
    title: "Binary Search",
    difficulty: "Easy",
    description: "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums.",
    examples: [
      { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4", explanation: "9 exists in nums and its index is 4." }
    ],
    constraints: ["1 <= nums.length <= 10^4", "-10^4 < nums[i], target < 10^4"],
    dataStructure: "Sorting & Searching"
  },
  {
    title: "Container With Most Water",
    difficulty: "Medium",
    description: "You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container, such that the container contains the most water.",
    examples: [
      { input: "height = [1,8,6,2,5,4,8,3,7]", output: "49", explanation: "The max area is 49." }
    ],
    constraints: ["n == height.length", "2 <= n <= 10^5", "0 <= height[i] <= 10^4"],
    dataStructure: "Two Pointers / Sliding Window"
  },
  {
    title: "Subsets",
    difficulty: "Medium",
    description: "Given an integer array nums of unique elements, return all possible subsets (the power set).",
    examples: [
      { input: "nums = [1,2,3]", output: "[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]", explanation: "All subsets are generated." }
    ],
    constraints: ["1 <= nums.length <= 10", "-10 <= nums[i] <= 10", "All the numbers of nums are unique."],
    dataStructure: "Backtracking"
  },
  {
    title: "Kth Largest Element",
    difficulty: "Medium",
    description: "Given an integer array nums and an integer k, return the kth largest element in the array.",
    examples: [
      { input: "nums = [3,2,1,5,6,4], k = 2", output: "5", explanation: "The 2nd largest element is 5." }
    ],
    constraints: ["1 <= k <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    dataStructure: "Heap / Priority Queue"
  }
];
