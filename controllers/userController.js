const User = require('../models/User.js');

 const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

 const getCandidates = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const candidates = await User.find({
      _id: { $ne: currentUser._id },
      gender: currentUser.preference === 'any' ? { $exists: true } : currentUser.preference,
      preference: currentUser.gender
    }).select('-password');
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getMe, getCandidates, getAllUsers}