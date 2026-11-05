const express = require('express');
const router = express.Router();
const {
  createBook,
  getAllBooks,
  getBookById,
} = require('../controllers/bookController');

router.post('/', createBook);
router.get('/', getAllBooks);
router.get('/:id', getBookById);

module.exports = router;