const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User.js');
const connectDB = require('../config/db.js');

dotenv.config();
connectDB();

const seedUsers = async () => {
  try {
    await User.deleteMany();

    await User.create([
      {
        name: 'Alice',
        email: 'alice@example.com',
        password: '123456',
        gender: 'female',
        preference: 'male',
        age: 25,
        location: 'New York',
        bio: 'Love books and long walks.',
        avatar: ''
      },
      {
        name: 'Bob',
        email: 'bob@example.com',
        password: '123456',
        gender: 'male',
        preference: 'female',
        age: 28,
        location: 'Los Angeles',
        bio: 'Adventure seeker.',
        avatar: ''
      },
      {
        name: 'Charlie',
        email: 'charlie@example.com',
        password: '123456',
        gender: 'male',
        preference: 'any',
        age: 30,
        location: 'Chicago',
        bio: 'Tech geek.',
        avatar: ''
      }
    ]);

    console.log('Sample users inserted');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedUsers();
