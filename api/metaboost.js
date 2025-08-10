module.exports = function handler(req, res) {
  // Allow CORS from anywhere (for testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    console.log('Received metaBoost:', req.body);
    res.status(200).json({ status: 'ok', received: req.body });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 