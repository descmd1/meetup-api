// const express = require('express');
// const { likeUser, dislikeUser } =require('../controllers/matchController.js');
// const protect = require('../middlewares/authMiddleware.js');
// const router = express.Router();

// router.post('/like/:id', protect, likeUser);
// router.post('/dislike/:id', protect, dislikeUser);

// module.exports = router;


const express = require('express');
const { likeUser, dislikeUser } = require('../controllers/matchController');
const protect = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/like/:id', protect, likeUser);
router.post('/dislike/:id', protect, dislikeUser);

module.exports = router;