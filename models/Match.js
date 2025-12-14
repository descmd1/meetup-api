const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  liked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  disliked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const Match = mongoose.model('Match', matchSchema);

module.exports = Match