const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Enable CORS manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Parse JSON bodies
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve main index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enhanced metaBoost endpoint
app.post('/api/metaboost', (req, res) => {
  console.log('📥 MetaBoost received:', req.body);
  
  // Basic validation
  if (!req.body.amount && !req.body.value_msat) {
    return res.status(400).json({ 
      error: 'Missing required field: amount',
      received: req.body 
    });
  }
  
  const response = {
    status: 'success',
    message: 'MetaBoost received successfully',
    data: {
      boostId: req.body.boostId || `boost_${Date.now()}`,
      amount: req.body.amount || Math.floor(req.body.value_msat / 1000),
      timestamp: new Date().toISOString()
    },
    received: req.body
  };
  
  console.log('✅ MetaBoost response:', response);
  res.json(response);
});

// Enhanced metaBoost viewer endpoint
app.get('/api/metaboost-viewer', (req, res) => {
  res.json({
    message: 'MetaBoost Viewer API',
    endpoints: {
      POST: 'Send metaBoost data',
      GET: 'Get this info'
    }
  });
});

app.post('/api/metaboost-viewer', (req, res) => {
  console.log('📊 MetaBoost viewer request:', req.body);
  
  if (req.body.action === 'list') {
    // Return empty list for now - in real implementation this would come from database
    res.json({
      boosts: [],
      count: 0,
      message: 'No metaBoosts stored yet (demo mode)'
    });
  } else {
    res.json({ status: 'ok', received: req.body });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'nwc-demo',
    timestamp: new Date().toISOString() 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 NWC Demo Server running on http://localhost:${PORT}`);
  console.log(`📄 Test MetaBoost Feed: http://localhost:${PORT}/test-metaboost-feed.html`);
  console.log(`📊 MetaBoost Viewer: http://localhost:${PORT}/test-metaboost.html`);
  console.log(`🏠 Main App: http://localhost:${PORT}/`);
});