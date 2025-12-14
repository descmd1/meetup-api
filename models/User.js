const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female', 'non-binary'], required: true },
  preference: { type: String, enum: ['male', 'female', 'any'], required: true },
  age: { type: Number, required: true },
  location: { type: String },
  bio: { type: String },
  avatar: { type: String },
  
  // Subscription fields
  subscriptionStatus: { 
    type: String, 
    enum: ['free', 'active', 'expired'], 
    default: 'free' 
  },
  subscriptionType: { 
    type: String, 
    enum: ['monthly', 'yearly'], 
    default: null 
  },
  subscriptionStartDate: { type: Date, default: null },
  subscriptionEndDate: { type: Date, default: null },
  subscriptionAmount: { type: Number, default: 0 },
  paystackCustomerId: { type: String, default: null },
  
  // Payment history
  paymentHistory: [{
    reference: String,
    amount: Number,
    type: { type: String, enum: ['monthly', 'yearly'] },
    status: { type: String, enum: ['success', 'failed', 'pending'] },
    paystackReference: String,
    paidAt: Date
  }]
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.hasActiveSubscription = function () {
  if (this.subscriptionStatus !== 'active') return false;
  if (!this.subscriptionEndDate) return false;
  return new Date() < this.subscriptionEndDate;
};

userSchema.methods.updateSubscriptionStatus = function () {
  if (this.subscriptionEndDate && new Date() > this.subscriptionEndDate) {
    this.subscriptionStatus = 'expired';
  }
  return this.subscriptionStatus === 'active' && this.hasActiveSubscription();
};

const User = mongoose.model('User', userSchema);
module.exports = User;