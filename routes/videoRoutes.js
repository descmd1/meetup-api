const express = require('express');
const { generateCallSession } = require('../controllers/videoController.js');
const protect =  require('../middlewares/authMiddleware.js');

const router = express.Router();
router.post('/start', protect, generateCallSession);

module.exports = router;