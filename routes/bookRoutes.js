const express = require('express');
const router = express.Router();
const { createBook, getAllBooks } = require('../controllers/bookController');

router.post('/', createBook);
router.get('/', getAllBooks);

module.exports = router;