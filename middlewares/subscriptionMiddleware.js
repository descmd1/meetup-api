const User = require('../models/User');

// Middleware to check if user has active subscription for premium features
const subscriptionMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update subscription status if expired
    user.updateSubscriptionStatus();
    await user.save();

    // Check if user has active subscription
    if (!user.hasActiveSubscription()) {
      return res.status(403).json({ 
        message: 'Active subscription required',
        subscriptionRequired: true,
        subscriptionStatus: user.subscriptionStatus
      });
    }

    // Add subscription info to request
    req.userSubscription = {
      status: user.subscriptionStatus,
      type: user.subscriptionType,
      endDate: user.subscriptionEndDate
    };

    next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Middleware for optional subscription check (doesn't block, just adds info)
const subscriptionInfoMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user) {
      user.updateSubscriptionStatus();
      await user.save();

      req.userSubscription = {
        hasActive: user.hasActiveSubscription(),
        status: user.subscriptionStatus,
        type: user.subscriptionType,
        endDate: user.subscriptionEndDate
      };
    }

    next();
  } catch (error) {
    console.error('Subscription info middleware error:', error);
    next(); // Don't block the request
  }
};

module.exports = { subscriptionMiddleware, subscriptionInfoMiddleware };