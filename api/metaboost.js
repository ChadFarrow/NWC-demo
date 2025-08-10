// Polyfill fetch for Node.js < 18
if (typeof fetch === 'undefined') {
  const nodeFetch = require('node-fetch');
  global.fetch = nodeFetch;
}

module.exports = function handler(req, res) {
  // Allow CORS from anywhere (for testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    console.log('Received metaBoost:', req.body);
    
    // Extract fields according to metaBoost spec
    const {
      amount,
      paymentProof,
      message,
      recipients,
      feedUrl,
      episodeGuid,
      timestamp,
      appName,
      senderName,
      boostId,
      paymentInfo,
      podcast,
      episode,
      action,
      ts,
      value_msat,
      value_msat_total
    } = req.body;
    
    // Basic validation
    if (!amount && !value_msat && !value_msat_total) {
      return res.status(400).json({ 
        error: 'Missing required field: amount or value_msat',
        required: ['amount (in sats) or value_msat or value_msat_total']
      });
    }
    
    if (!paymentProof) {
      return res.status(400).json({ 
        error: 'Missing required field: paymentProof',
        required: ['paymentProof']
      });
    }
    
    // Process the metaBoost data following the spec
    const processedBoost = {
      id: boostId || `boost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'received',
      timestamp: timestamp || ts || new Date().toISOString(),
      amount: amount || (value_msat ? Math.floor(value_msat / 1000) : null) || (value_msat_total ? Math.floor(value_msat_total / 1000) : null),
      value_msat: value_msat || (amount ? amount * 1000 : null),
      value_msat_total: value_msat_total || value_msat || (amount ? amount * 1000 : null),
      paymentProof,
      message: message || '',
      action: action || 'boost',
      recipients: recipients || [],
      podcast: podcast || feedUrl || 'unknown',
      episode: episode || episodeGuid || null,
      appName: appName || 'unknown',
      senderName: senderName || 'anonymous',
      paymentInfo: paymentInfo || {},
      processingTime: new Date().toISOString()
    };
    
    // Log for debugging
    console.log('Processed metaBoost:', processedBoost);
    
    // Store in viewer (optional - for demo purposes)
    try {
      const viewerUrl = `https://${req.headers.host}/api/metaboost-viewer`;
      fetch(viewerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', boost: processedBoost })
      }).catch(err => console.log('Could not update viewer:', err));
    } catch (e) {
      // Ignore viewer errors
    }
    
    // Return success response per spec
    res.status(200).json({ 
      status: 'ok',
      message: 'metaBoost received successfully',
      boostId: processedBoost.id,
      processed: processedBoost
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 