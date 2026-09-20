const mongoose = require('mongoose');

const exampleSchema = new mongoose.Schema({
  input: { type: String, required: true },
  output: { type: String, required: true },
  explanation: { type: String }
}, { _id: false });

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expected: { type: String, required: true },
}, { _id: false });

const problemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
  description: { type: String, required: true },
  examples: [exampleSchema],
  constraints: [{ type: String }],
  testCases: [testCaseSchema],
  starterCode: {
    python: { type: String, default: '' },
    javascript: { type: String, default: '' },
    java: { type: String, default: '' },
    cpp: { type: String, default: '' },
  },
  dataStructure: {
    type: String,
    enum: [
      'Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 'Trees & Graphs',
      'Dynamic Programming', 'Hashing', 'Sorting & Searching',
      'Two Pointers / Sliding Window', 'Backtracking', 'Heap / Priority Queue'
    ],
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Problem', problemSchema);
