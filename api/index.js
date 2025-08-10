// Main API handler for all routes
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Debug: log the request details
  console.log('API Request:', {
    method: req.method,
    url: req.url,
    path: req.url,
    headers: req.headers
  });

  // Extract the path from the URL
  const path = req.url.replace('/api', '').replace('/', '');
  
  // Health check
  if (path === '' || path === 'index') {
    res.status(200).json({ 
      status: 'ok', 
      message: 'V4V Lightning Payment Tester API',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // metaBoost endpoint
  if (path === 'metaboost') {
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
      
      // Return success response per spec
      res.status(200).json({ 
        status: 'ok',
        message: 'metaBoost received successfully',
        boostId: processedBoost.id,
        processed: processedBoost
      });
    } else {
      res.status(405).json({ error: 'Method not allowed. Use POST for metaBoost.' });
    }
    return;
  }

  res.status(404).json({ 
    error: 'Not found', 
    path: path,
    url: req.url,
    method: req.method
  });
}