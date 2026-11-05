const express = require('express');
const router = express.Router();
const {
  createAuthor,
  getAllAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getBooksByAuthor,
  getAuthorStats,
} = require('../controllers/authorController');

router.post('/', createAuthor);
router.get('/', getAllAuthors);
router.get('/:id', getAuthorById);
router.get('/:id/books', getBooksByAuthor);
router.get('/:id/stats', getAuthorStats);
router.put('/:id', updateAuthor);
router.delete('/:id', deleteAuthor);

module.exports = router;