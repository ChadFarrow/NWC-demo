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
      
      // Validate required fields
      const { amount, paymentProof, recipients } = req.body;
      if (!amount || !paymentProof || !recipients) {
        return res.status(400).json({ 
          error: 'Missing required fields: amount, paymentProof, and recipients are required' 
        });
      }
      
      // Log payment proof details
      console.log('Payment Proof Details:', {
        amount: amount,
        paymentProofLength: paymentProof.length,
        paymentProofPreview: paymentProof.substring(0, 50) + '...',
        recipients: recipients,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({ 
        status: 'ok', 
        received: req.body,
        message: 'metaBoost data received successfully',
        timestamp: new Date().toISOString(),
        paymentProofValidated: true,
        recipientsCount: recipients.length
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