const mongoose = require('mongoose');
const Author = require('../models/Author');

// POST /authors — create a new author
const createAuthor = async (req, res) => {
  try {
    const { name, country, bio } = req.body || {};
    const author = await Author.create({ name, country, bio });
    res.status(201).json(author);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /authors — get all authors
const getAllAuthors = async (req, res) => {
  try {
    const authors = await Author.find();
    res.status(200).json(authors);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// GET /authors/:id — get one author
const getAuthorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid author id format' });
    }

    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: `No author found with id ${id}` });
    }

    res.status(200).json(author);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
module.exports = {
  createAuthor,
  getAllAuthors,
  getAuthorById,
};