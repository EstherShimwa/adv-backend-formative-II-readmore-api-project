const mongoose = require('mongoose');
const Book = require('../models/Book');

// POST /books — create a book for an author
const createBook = async (req, res) => {
  try {
    const { title, genre, price, publishedYear, author } = req.body || {};
    const book = await Book.create({ title, genre, price, publishedYear, author });
    res.status(201).json(book);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createBook,
};