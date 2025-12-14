// const express = require('express');
// const { sendMessage, getMessages } = require('../controllers/messageController.js');
// const protect = require('../middlewares/authMiddleware.js');
// const router = express.Router();

// router.post('/', protect, sendMessage);
// router.get('/:userId', protect, getMessages);

// module.exports = router;



const express = require('express');
const router = express.Router();
const protect = require('../middlewares/authMiddleware');
const { subscriptionMiddleware } = require('../middlewares/subscriptionMiddleware');
const {
  sendMessage,
  getMessages,
  toggleLike,
  editMessage,
  deleteMessage
} = require('../controllers/messageController');

// All message routes require active subscription
router.post('/', protect, subscriptionMiddleware, sendMessage);
router.get('/:userId', protect, subscriptionMiddleware, getMessages);
router.put('/like', protect, subscriptionMiddleware, toggleLike);
router.put('/edit', protect, subscriptionMiddleware, editMessage);
router.put('/delete', protect, subscriptionMiddleware, deleteMessage);

module.exports = router;