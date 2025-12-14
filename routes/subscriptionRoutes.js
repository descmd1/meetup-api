const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middlewares/authMiddleware');

// Paystack configuration - these will be set after dotenv is loaded by server.js
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// This function gets the key dynamically to ensure it's loaded after dotenv
const getPaystackKey = () => process.env.PAYSTACK_SECRET_KEY;

// Subscription plans
const SUBSCRIPTION_PLANS = {
  monthly: {
    amount: 200000, // ₦2,000 in kobo
    duration: 30, // days
    name: 'Monthly Subscription'
  },
  yearly: {
    amount: 2000000, // ₦20,000 in kobo (10 months price for yearly)
    duration: 365, // days
    name: 'Yearly Subscription'
  }
};

// Get user's subscription status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Update subscription status if expired
    user.updateSubscriptionStatus();
    await user.save();

    res.json({
      status: user.subscriptionStatus,
      subscriptionStatus: user.subscriptionStatus, // Keep for backward compatibility
      subscriptionType: user.subscriptionType,
      subscriptionEndDate: user.subscriptionEndDate,
      hasActiveSubscription: user.hasActiveSubscription(),
      daysRemaining: user.subscriptionEndDate 
        ? Math.ceil((user.subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24))
        : 0
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initialize payment
router.post('/initialize-payment', authMiddleware, async (req, res) => {
  try {
    const { planType } = req.body; // 'monthly' or 'yearly'
    const user = await User.findById(req.user.id);
    const PAYSTACK_SECRET_KEY = getPaystackKey();

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ 
        success: false, 
        message: 'Payment gateway not configured' 
      });
    }

    if (!SUBSCRIPTION_PLANS[planType]) {
      return res.status(400).json({ message: 'Invalid subscription plan' });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    
    // Create payment reference
    const reference = `meetup_${planType}_${user._id}_${Date.now()}`;
    console.log('Generated reference:', reference);

    // Initialize transaction with Paystack
    const paymentData = {
      reference,
      amount: plan.amount,
      email: user.email,
      currency: 'NGN',
      callback_url: `${process.env.FRONTEND_URL}/subscription/callback`,
      metadata: {
        userId: user._id,
        planType,
        planName: plan.name
      },
      channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
    };

    // Use direct HTTP call instead of paystack-api package
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status) {
      res.json({
        success: true,
        authorizationUrl: response.data.data.authorization_url,
        reference: response.data.data.reference,
        amount: plan.amount,
        planType,
        planName: plan.name
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: response.data.message || 'Failed to initialize payment' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Payment initialization failed'
    });
  }
});

// Verify payment
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.body;
    const user = await User.findById(req.user.id);
    const PAYSTACK_SECRET_KEY = getPaystackKey();

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ success: false, message: 'Payment gateway configuration error' });
    }

    // Verify transaction with Paystack using direct HTTP call
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (response.data.status && response.data.data.status === 'success') {
      const { metadata, amount } = response.data.data;
      const planType = metadata.planType;
      const plan = SUBSCRIPTION_PLANS[planType];

      // Update user subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + plan.duration);

      user.subscriptionStatus = 'active';
      user.subscriptionType = planType;
      user.subscriptionStartDate = startDate;
      user.subscriptionEndDate = endDate;
      user.subscriptionAmount = amount / 100; // Convert from kobo to naira

      // Initialize paymentHistory array if it doesn't exist
      if (!user.paymentHistory) {
        user.paymentHistory = [];
      }

      // Add to payment history
      user.paymentHistory.push({
        reference,
        amount: amount / 100,
        type: planType,
        status: 'success',
        paystackReference: response.data.data.reference,
        paidAt: new Date()
      });

      await user.save();

      res.json({
        success: true,
        message: 'Subscription activated successfully!',
        subscription: {
          status: user.subscriptionStatus,
          type: user.subscriptionType,
          startDate: user.subscriptionStartDate,
          endDate: user.subscriptionEndDate
        }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Payment verification failed'
    });
  }
});// Paystack webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash === req.headers['x-paystack-signature']) {
      const event = req.body;
      
      if (event.event === 'charge.success') {
        const { reference, metadata, amount, status } = event.data;
        
        if (status === 'success' && metadata.userId) {
          const user = await User.findById(metadata.userId);
          if (user) {
            // Update subscription (similar to verify-payment logic)
            const planType = metadata.planType;
            const plan = SUBSCRIPTION_PLANS[planType];

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + plan.duration);

            user.subscriptionStatus = 'active';
            user.subscriptionType = planType;
            user.subscriptionStartDate = startDate;
            user.subscriptionEndDate = endDate;
            user.subscriptionAmount = amount / 100;

            await user.save();
          }
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(400);
  }
});

// Test endpoints
router.get('/test-verify', async (req, res) => {
  const { reference } = req.query;
  
  if (!reference) {
    return res.status(400).json({ success: false, message: 'Reference is required' });
  }
  
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.response?.data || error.message
    });
  }
});

router.get('/test-paystack', (req, res) => {
  res.json({
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ? 'Set' : 'Not set',
    secretKey: process.env.PAYSTACK_SECRET_KEY ? 'Set' : 'Not set',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get subscription plans
router.get('/plans', (req, res) => {
  res.json({
    plans: {
      monthly: {
        name: SUBSCRIPTION_PLANS.monthly.name,
        amount: SUBSCRIPTION_PLANS.monthly.amount / 100, // Convert to naira
        duration: '1 month',
        features: [
          'Unlimited messaging',
          'Video & Audio calls',
          'Advanced matching',
          'Priority support'
        ]
      },
      yearly: {
        name: SUBSCRIPTION_PLANS.yearly.name,
        amount: SUBSCRIPTION_PLANS.yearly.amount / 100, // Convert to naira
        duration: '12 months',
        features: [
          'Unlimited messaging',
          'Video & Audio calls',
          'Advanced matching',
          'Priority support',
          '2 months FREE!'
        ]
      }
    }
  });
});

// Paystack webhook endpoint
router.post('/webhook', async (req, res) => {
  try {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                      .update(JSON.stringify(req.body))
                      .digest('hex');
    
    if (hash === req.headers['x-paystack-signature']) {
      const event = req.body;
      console.log('Paystack webhook received:', event);
      
      if (event.event === 'charge.success') {
        const { reference, metadata, amount, status } = event.data;
        console.log('Successful charge webhook:', { reference, metadata, amount, status });
        
        if (metadata && metadata.userId && metadata.planType) {
          const user = await User.findById(metadata.userId);
          if (user && status === 'success') {
            const plan = SUBSCRIPTION_PLANS[metadata.planType];
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + plan.duration);
            
            // Update user subscription
            user.subscriptionStatus = 'active';
            user.subscriptionType = metadata.planType;
            user.subscriptionStartDate = startDate;
            user.subscriptionEndDate = endDate;
            
            // Add to payment history
            user.paymentHistory.push({
              amount: amount / 100, // Convert from kobo to naira
              reference: reference,
              status: 'success',
              planType: metadata.planType,
              date: new Date()
            });
            
            await user.save();
            console.log('User subscription updated via webhook:', user.email);
          }
        }
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to Paystack
  }
});

module.exports = router;