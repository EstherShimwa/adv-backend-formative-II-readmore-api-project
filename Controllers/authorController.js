const mongoose = require('mongoose');
const Author = require('../models/Author');
const Book = require('../models/Book');

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

// PUT /authors/:id — update an author
const updateAuthor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid author id format' });
    }

    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: `No author found with id ${id}` });
    }

    const { name, country, bio } = req.body || {};
    if (name !== undefined) author.name = name;
    if (country !== undefined) author.country = country;
    if (bio !== undefined) author.bio = bio;

    const updatedAuthor = await author.save();
    res.status(200).json(updatedAuthor);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /authors/:id — delete an author
// Rule 4 policy: BLOCK (Option A) — an author who still has books cannot be deleted
const deleteAuthor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid author id format' });
    }

    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: `No author found with id ${id}` });
    }

    // Rule 4: refuse if this author still has books, and show which ones
    const books = await Book.find({ author: id }).select('title');
    if (books.length > 0) {
      return res.status(409).json({
        message: `Cannot delete ${author.name}: they still have ${books.length} book(s). Delete or reassign these books first.`,
        books: books.map((book) => ({ id: book._id, title: book.title })),
      });
    }

    await author.deleteOne();
    res.status(200).json({ message: 'Author deleted successfully', author });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /authors/:id/books — all books by one author
const getBooksByAuthor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid author id format' });
    }

    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: `No author found with id ${id}` });
    }

    const books = await Book.find({ author: id });
    res.status(200).json({
      author: author.name,
      count: books.length,
      books,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /authors/:id/stats — summary of one author's books (Rule 6)
const getAuthorStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid author id format' });
    }

    const author = await Author.findById(id);
    if (!author) {
      return res.status(404).json({ message: `No author found with id ${id}` });
    }

    // Cheapest first; if two books cost the same, alphabetical title decides
    const books = await Book.find({ author: id }).sort({ price: 1, title: 1 });

    // No books: return sensible "not applicable" values instead of crashing
    if (books.length === 0) {
      return res.status(200).json({
        author: author.name,
        bookCount: 0,
        averagePrice: null,
        cheapestBook: null,
        mostExpensiveBook: null,
      });
    }

    const total = books.reduce((sum, book) => sum + book.price, 0);
    const averagePrice = Math.round((total / books.length) * 100) / 100;

    res.status(200).json({
      author: author.name,
      bookCount: books.length,
      averagePrice,
      cheapestBook: books[0].title,
      mostExpensiveBook: books[books.length - 1].title,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createAuthor,
  getAllAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getBooksByAuthor,
  getAuthorStats,
};