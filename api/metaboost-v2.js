// Enhanced MetaBoost API v2
// Implements the Podcasting 2.0 metaBoost specification
// Based on: https://github.com/Podcastindex-org/podcast-namespace/discussions/676

const crypto = require('crypto');

module.exports = function handler(req, res) {
  // Allow CORS from anywhere (for testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { 
      amount, 
      paymentProof, 
      message, 
      podcast, 
      episode, 
      appName, 
      senderName, 
      feedUrl, 
      episodeGuid, 
      recipients,
      value_msat,
      value_msat_total,
      boostId,
      timestamp,
      action
    } = req.body;

    // Enhanced validation for v2
    if (!amount && !value_msat && !value_msat_total) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount (in sats) or value_msat or value_msat_total', 'paymentProof']
      });
    }

    if (!paymentProof) {
      return res.status(400).json({ 
        error: 'Missing required field: paymentProof',
        required: ['paymentProof']
      });
    }

    // Process the metaBoost data following the v2 spec
    const processedBoost = {
      id: boostId || `boost_v2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'received',
      timestamp: timestamp || new Date().toISOString(),
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
      processingTime: new Date().toISOString(),
      version: '2.0'
    };

    console.log('✅ MetaBoost v2 received:', processedBoost);

    // In a real implementation, you would:
    // 1. Validate the payment proof cryptographically
    // 2. Process the Lightning payment
    // 3. Store the boost in a database
    // 4. Send confirmation to the podcast app
    // 5. Update any analytics or tracking systems

    res.status(200).json({ 
      status: 'success',
      message: 'MetaBoost v2 received successfully',
      boostId: processedBoost.id,
      processed: processedBoost
    });

  } catch (error) {
    console.error('❌ Error processing MetaBoost v2:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};