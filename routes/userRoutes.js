const express = require('express');
const { getMe, getCandidates, getAllUsers } = require('../controllers/userController.js');
const protect = require('../middlewares/authMiddleware.js');
const router = express.Router();

router.get('/me', protect, getMe);
router.get('/match-candidates', protect, getCandidates);
router.get('/all', protect, getAllUsers);

module.exports = router;