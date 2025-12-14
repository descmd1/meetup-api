const User = require('../models/User.js');
const jwt = require('jsonwebtoken');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

 const signup = async (req, res) => {
  const { name, email, password, gender, preference, age, location, bio, avatar } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ name, email, password, gender, preference, age, location, bio, avatar });
    const token = generateToken(user._id);
    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

 const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = generateToken(user._id);
    
    // Return both token and user data (excluding password)
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      gender: user.gender,
      preference: user.preference,
      age: user.age,
      location: user.location,
      bio: user.bio,
      avatar: user.avatar
    };
    
    res.json({ token, user: userData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {signup, login}