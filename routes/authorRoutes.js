const express = require('express');
const router = express.Router();
const { createAuthor, getAllAuthors } = require('../controllers/authorController');

router.post('/', createAuthor);
router.get('/', getAllAuthors);

module.exports = router;