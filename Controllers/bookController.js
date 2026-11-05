const mongoose = require('mongoose');
const Book = require('../models/Book');
const Author = require('../models/Author');

const AUTHOR_FIELDS = 'name country bio';
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const MIN_YEAR = 1450;
const SORTABLE_FIELDS = ['price', 'title', 'publishedYear'];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

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

// Helper: was this query parameter actually sent with a value?
const isPresent = (value) => typeof value === 'string' && value.trim() !== '';

// Helper: escape special regex characters so user text is searched literally
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// GET /books — filters, search, sorting (Rule 5) and pagination (challenge)
// Example: /books?genre=Fiction&minPrice=10&maxPrice=30&search=sea&sort=price&order=asc&page=1&limit=5
const getAllBooks = async (req, res) => {
  try {
    const { genre, minPrice, maxPrice, author, search, sort, order, page, limit } = req.query;

    // Start with an empty filter and only add what the client actually sent
    const filter = {};

    if (isPresent(genre)) {
      filter.genre = new RegExp(`^${escapeRegex(genre.trim())}$`, 'i');
    }

    if (isPresent(minPrice) || isPresent(maxPrice)) {
      filter.price = {};

      if (isPresent(minPrice)) {
        const min = Number(minPrice);
        if (Number.isNaN(min)) {
          return res.status(400).json({ message: 'minPrice must be a number' });
        }
        filter.price.$gte = min;
      }

      if (isPresent(maxPrice)) {
        const max = Number(maxPrice);
        if (Number.isNaN(max)) {
          return res.status(400).json({ message: 'maxPrice must be a number' });
        }
        filter.price.$lte = max;
      }

      if (filter.price.$gte !== undefined && filter.price.$lte !== undefined
        && filter.price.$gte > filter.price.$lte) {
        return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
      }
    }

    if (isPresent(author)) {
      if (!mongoose.Types.ObjectId.isValid(author)) {
        return res.status(400).json({ message: 'author must be a valid author id' });
      }
      filter.author = author;
    }

    if (isPresent(search)) {
      filter.title = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }

    // Sorting: only allowed fields, ascending by default.
    // _id is a tie-breaker so pages stay consistent when values are equal.
    let sortOption = { _id: 1 };
    if (isPresent(sort)) {
      if (!SORTABLE_FIELDS.includes(sort)) {
        return res.status(400).json({
          message: `sort must be one of: ${SORTABLE_FIELDS.join(', ')}`,
        });
      }
      if (isPresent(order) && !['asc', 'desc'].includes(order)) {
        return res.status(400).json({ message: 'order must be "asc" or "desc"' });
      }
      sortOption = { [sort]: order === 'desc' ? -1 : 1, _id: 1 };
    }

    // Pagination: only applied when page or limit is sent
    const usePaging = isPresent(page) || isPresent(limit);
    const pageNum = isPresent(page) ? Number(page) : 1;
    const limitNum = isPresent(limit) ? Number(limit) : DEFAULT_LIMIT;

    if (usePaging) {
      if (!Number.isInteger(pageNum) || pageNum < 1) {
        return res.status(400).json({ message: 'page must be a whole number of 1 or more' });
      }
      if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > MAX_LIMIT) {
        return res.status(400).json({ message: `limit must be a whole number between 1 and ${MAX_LIMIT}` });
      }
    }

    const total = await Book.countDocuments(filter);

    let query = Book.find(filter).sort(sortOption).populate('author', AUTHOR_FIELDS);
    if (usePaging) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }
    const books = await query;

    res.status(200).json({
      page: usePaging ? pageNum : 1,
      limit: usePaging ? limitNum : total,
      total,
      totalPages: usePaging ? Math.ceil(total / limitNum) : 1,
      results: books,
    });
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