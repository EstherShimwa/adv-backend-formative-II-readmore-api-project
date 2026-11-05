const mongoose = require('mongoose');
const Book = require('../models/Book');
const Author = require('../models/Author');

const AUTHOR_FIELDS = 'name country bio';
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const MIN_YEAR = 1450;

// Helper: returns true only if the id is valid AND belongs to a real author
const authorExists = async (authorId) => {
  if (!mongoose.Types.ObjectId.isValid(authorId)) return false;
  const found = await Author.exists({ _id: authorId });
  return Boolean(found);
};

// Helper: does this author already have a book with this title? (case-insensitive)
// excludeBookId lets a book keep its own title when it is updated
const titleTakenByAuthor = async (title, authorId, excludeBookId = null) => {
  const filter = { author: authorId, title: title.trim() };
  if (excludeBookId) filter._id = { $ne: excludeBookId };
  const existing = await Book.findOne(filter).collation(CASE_INSENSITIVE);
  return Boolean(existing);
};

// Helper: business rules for price and publishedYear (Rule 3)
// Returns a list of error messages — empty list means everything is fine
const getRuleErrors = ({ price, publishedYear }) => {
  const errors = [];

  if (price !== undefined) {
    if (typeof price !== 'number' || Number.isNaN(price)) {
      errors.push('price must be a number');
    } else if (price <= 0) {
      errors.push('price must be greater than 0');
    }
  }

  if (publishedYear !== undefined) {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(publishedYear)) {
      errors.push('publishedYear must be a whole number');
    } else if (publishedYear > currentYear) {
      errors.push(`publishedYear cannot be in the future (after ${currentYear})`);
    } else if (publishedYear < MIN_YEAR) {
      errors.push(`publishedYear cannot be before ${MIN_YEAR}`);
    }
  }

  return errors;
};

// POST /books — create a book for an author
const createBook = async (req, res) => {
  try {
    const { title, genre, price, publishedYear, author } = req.body || {};

    // Rule 1: no orphan books
    if (!(await authorExists(author))) {
      return res.status(400).json({
        message: 'Cannot create book: "author" must be the id of an existing author',
      });
    }

    // Rule 3: price and year must make sense
    const ruleErrors = getRuleErrors({ price, publishedYear });
    if (ruleErrors.length > 0) {
      return res.status(422).json({ message: 'Invalid book data', errors: ruleErrors });
    }

    // Rule 2: no duplicate titles for the same author
    if (typeof title === 'string' && (await titleTakenByAuthor(title, author))) {
      return res.status(409).json({
        message: `This author already has a book titled "${title.trim()}"`,
      });
    }

    const book = await Book.create({ title, genre, price, publishedYear, author });
    await book.populate('author', AUTHOR_FIELDS);
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
    const books = await Book.find().populate('author', AUTHOR_FIELDS);
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

    const book = await Book.findById(id).populate('author', AUTHOR_FIELDS);
    if (!book) {
      return res.status(404).json({ message: `No book found with id ${id}` });
    }

    res.status(200).json(book);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /books/:id — update a book
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid book id format' });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ message: `No book found with id ${id}` });
    }

    const { title, genre, price, publishedYear, author } = req.body || {};

    // Rule 1: if the author is being changed, it must be a real author
    if (author !== undefined && !(await authorExists(author))) {
      return res.status(400).json({
        message: 'Cannot update book: "author" must be the id of an existing author',
      });
    }

    // Rule 3: price and year must make sense (only the fields being changed)
    const ruleErrors = getRuleErrors({ price, publishedYear });
    if (ruleErrors.length > 0) {
      return res.status(422).json({ message: 'Invalid book data', errors: ruleErrors });
    }

    // Rule 2: the new title/author combination must not clash with another book
    if (title !== undefined || author !== undefined) {
      const newTitle = title !== undefined ? title : book.title;
      const newAuthor = author !== undefined ? author : book.author;
      if (typeof newTitle === 'string' && (await titleTakenByAuthor(newTitle, newAuthor, book._id))) {
        return res.status(409).json({
          message: `This author already has a book titled "${newTitle.trim()}"`,
        });
      }
    }

    if (title !== undefined) book.title = title;
    if (genre !== undefined) book.genre = genre;
    if (price !== undefined) book.price = price;
    if (publishedYear !== undefined) book.publishedYear = publishedYear;
    if (author !== undefined) book.author = author;

    const updatedBook = await book.save();
    await updatedBook.populate('author', AUTHOR_FIELDS);
    res.status(200).json(updatedBook);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /books/:id — delete a book
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid book id format' });
    }

    const book = await Book.findByIdAndDelete(id);
    if (!book) {
      return res.status(404).json({ message: `No book found with id ${id}` });
    }

    res.status(200).json({ message: 'Book deleted successfully', book });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
};