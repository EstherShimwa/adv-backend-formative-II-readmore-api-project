require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();

// Lets us read JSON from request bodies (needed for POST and PUT)
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'ReadMore API is running' });
});
const authorRoutes = require('./routes/authorRoutes');
app.use('/authors', authorRoutes);
const PORT = process.env.PORT || 3000;

// Connect to MongoDB first, then start the server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });