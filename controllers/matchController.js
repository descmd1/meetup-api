// const Match = require('../models/Match.js');

// const likeUser = async (req, res) => {
//   try {
//     const match = await Match.findOneAndUpdate(
//       { user: req.user.id },
//       { $addToSet: { liked: req.params.id } },
//       { new: true, upsert: true }
//     );
//     res.json(match);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// const dislikeUser = async (req, res) => {
//   try {
//     const match = await Match.findOneAndUpdate(
//       { user: req.user.id },
//       { $addToSet: { disliked: req.params.id } },
//       { new: true, upsert: true }
//     );
//     res.json(match);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// module.exports = {likeUser, dislikeUser}



const Match = require('../models/Match.js');

const likeUser = async (req, res) => {
  try {
    const match = await Match.findOneAndUpdate(
      { user: req.user.id },
      { $addToSet: { liked: req.params.id } },
      { new: true, upsert: true }
    );
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const dislikeUser = async (req, res) => {
  try {
    const match = await Match.findOneAndUpdate(
      { user: req.user.id },
      { $addToSet: { disliked: req.params.id } },
      { new: true, upsert: true }
    );
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { likeUser, dislikeUser };