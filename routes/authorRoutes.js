const express = require('express');
const router = express.Router();
const {
  createAuthor,
  getAllAuthors,
  getAuthorById,
  updateAuthor,
} = require('../controllers/authorController');

router.post('/', createAuthor);
router.get('/', getAllAuthors);
router.get('/:id', getAuthorById);
router.put('/:id', updateAuthor);

module.exports = router;