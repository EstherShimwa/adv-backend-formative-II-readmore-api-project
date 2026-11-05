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


// GET /books — get all books (with author details)
const getAllBooks = async (req, res) => {
  try {
    const books = await Book.find().populate('author', 'name country bio');
    res.status(200).json(books);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /books/:id — get one book (with author details)
const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid book id format' });
    }

    const book = await Book.findById(id).populate('author', 'name country bio');
    if (!book) {
      return res.status(404).json({ message: `No book found with id ${id}` });
    }

    res.status(200).json(book);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
module.exports = {
  createBook,
  getAllBooks,
  getBookById,
};