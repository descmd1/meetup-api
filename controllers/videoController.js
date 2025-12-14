 const generateCallSession = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const roomId = `${req.user._id}-${receiverId}-${Date.now()}`;
    res.status(200).json({ roomId });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate video session' });
  }
};

module.exports = {generateCallSession}