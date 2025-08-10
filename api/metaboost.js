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
    const { amount, paymentProof, message, podcast, episode, appName, senderName, feedUrl, episodeGuid, recipients } = req.body;

    if (!amount || !paymentProof) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'paymentProof']
      });
    }

    const boost = {
      id: `boost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      amount,
      paymentProof,
      message: message || '',
      podcast: podcast || 'Unknown',
      episode: episode || 'Unknown',
      appName: appName || 'Unknown',
      senderName: senderName || 'Anonymous',
      feedUrl: feedUrl || '',
      episodeGuid: episodeGuid || '',
      recipients: recipients || []
    };

    console.log('✅ MetaBoost received:', boost);

    // In a real implementation, you would:
    // 1. Validate the payment proof
    // 2. Process the Lightning payment
    // 3. Store the boost in a database
    // 4. Send confirmation to the podcast app

    res.status(200).json({ 
      status: 'success',
      message: 'MetaBoost received successfully',
      data: boost
    });

  } catch (error) {
    console.error('❌ Error processing MetaBoost:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}; 