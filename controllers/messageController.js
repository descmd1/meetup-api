// const Message = require('../models/Message.js');

//  const sendMessage = async (req, res) => {
//   const { receiver, text } = req.body;
//   try {
//     const message = await Message.create({
//       sender: req.user._id,
//       receiver,
//       text
//     });
//     res.status(201).json(message);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// const getMessages = async (req, res) => {
//   const { userId } = req.params;
//   try {
//     const messages = await Message.find({
//       $or: [
//         { sender: req.user._id, receiver: userId },
//         { sender: userId, receiver: req.user._id }
//       ]
//     }).sort({ timestamp: 1 });
//     res.json(messages);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// module.exports = {sendMessage, getMessages}



const Message = require('../models/Message');

const sendMessage = async (req, res) => {
  const { receiver, text, replyTo = null } = req.body;
  try {
    const message = await Message.create({
      sender: req.user._id,
      receiver,
      text,
      replyTo
    });

    // Populate the message with replyTo data before emitting
    const populatedMessage = await Message.findById(message._id)
      .populate({
        path: 'replyTo',
        select: 'text sender createdAt',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });

    // Emit socket event to notify receiver in real-time
    const io = req.app.get('io');
    if (io) {
      // Send to receiver
      io.to(String(receiver)).emit('receive-message', populatedMessage);
      // Also send to sender for consistency (in case they have multiple tabs open)
      io.to(String(req.user._id)).emit('receive-message', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMessages = async (req, res) => {
  const { userId } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    })
    .populate({
      path: 'replyTo',
      select: 'text sender createdAt',
      populate: {
        path: 'sender',
        select: 'name'
      }
    })
    .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  const { messageId, action } = req.body;
  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (action === 'like') {
      message.likedBy.addToSet(req.user._id);
      message.dislikedBy.pull(req.user._id);
    } else if (action === 'dislike') {
      message.dislikedBy.addToSet(req.user._id);
      message.likedBy.pull(req.user._id);
    }

    await message.save();

    // Populate the message with replyTo data before emitting
    const populatedMessage = await Message.findById(message._id)
      .populate({
        path: 'replyTo',
        select: 'text sender createdAt',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(String(message.receiver)).emit('update-message', populatedMessage);
      io.to(String(message.sender)).emit('update-message', populatedMessage);
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// const editMessage = async (req, res) => {
//   const { messageId, newText } = req.body;
//   try {
//     const message = await Message.findOne({ _id: messageId, sender: req.user._id });
//     if (!message) return res.status(404).json({ message: 'Not found or not yours' });

//     message.text = newText;
//     message.edited = true;
//     await message.save();

//     res.json(message);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

const editMessage = async (req, res) => {
  const { messageId, newText } = req.body;

  try {
    const message = await Message.findOne({ _id: messageId, sender: req.user._id });

    if (!message) return res.status(404).json({ message: 'Not found or not yours' });

    message.text = newText;
    message.edited = true;
    await message.save();

    // ✅ Ensure sender and receiver are present before emitting
    const io = req.app.get('io');
    if (message.receiver && message.sender) {
      io.to(message.receiver.toString()).emit('edit-message', {
        messageId: message._id,
        newText: message.text
      });

      io.to(message.sender.toString()).emit('edit-message', {
        messageId: message._id,
        newText: message.text
      });
    }

    res.json(message);
  } catch (err) {
    console.error('Edit Message Error:', err);
    res.status(500).json({ message: err.message });
  }
};


const deleteMessage = async (req, res) => {
  const { messageId } = req.body;
  try {
    const message = await Message.findOne({ _id: messageId, sender: req.user._id });
    if (!message) return res.status(404).json({ message: 'Not found or not yours' });

    message.text = 'This message was deleted';
    message.deleted = true;
    await message.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io && message.receiver && message.sender) {
      io.to(String(message.receiver)).emit('delete-message', { messageId: message._id });
      io.to(String(message.sender)).emit('delete-message', { messageId: message._id });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  toggleLike,
  editMessage,
  deleteMessage
};
