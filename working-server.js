const express = require('express');
const app = express();
const PORT = 3003;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.listen(PORT, () => {
  console.log(`Working server running on port ${PORT}`);
});
