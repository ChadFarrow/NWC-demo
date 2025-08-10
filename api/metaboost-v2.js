// Enhanced MetaBoost API v2
// Implements the Podcasting 2.0 metaBoost specification
// Based on: https://github.com/Podcastindex-org/podcast-namespace/discussions/676

const crypto = require('crypto');

// MetaBoost JSON Schema (preliminary based on discussion)
const METABOOST_SCHEMA = {
  required: ['amount', 'paymentProof', 'feedUrl'],
  optional: [
    'comment', 'message', 'appName', 'username', 'senderName', 
    'episodeGuid', 'timestamp', 'boostId', 'recipients', 
    'podcast', 'episode', 'paymentInfo', 'signature'
  ],
  paymentProofSchema: {
    required: ['type', 'success'],
    optional: [
      'destination', 'amount_msat', 'amount_sats', 'payment_hash', 
      'preimage', 'invoice', 'timestamp', 'message', 'fee_msat'
    ]
  }
};

// Validate metaBoost payload
function validateMetaBoost(payload) {
  const errors = [];
  
  // Check required fields
  METABOOST_SCHEMA.required.forEach(field => {
    if (!payload[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate amount
  if (payload.amount && (typeof payload.amount !== 'number' || payload.amount <= 0)) {
    errors.push('Amount must be a positive number');
  }
  
  // Validate paymentProof
  if (payload.paymentProof) {
    let proof;
    try {
      proof = typeof payload.paymentProof === 'string' 
        ? JSON.parse(payload.paymentProof) 
        : payload.paymentProof;
    } catch (e) {
      errors.push('PaymentProof must be valid JSON');
      return errors;
    }
    
    // Validate payment proof structure
    METABOOST_SCHEMA.paymentProofSchema.required.forEach(field => {
      if (!proof[field]) {
        errors.push(`Payment proof missing required field: ${field}`);
      }
    });
    
    if (proof.success !== true && proof.success !== false) {
      errors.push('Payment proof success field must be boolean');
    }
  }
  
  // Validate feedUrl format
  if (payload.feedUrl) {
    try {
      new URL(payload.feedUrl);
    } catch (e) {
      errors.push('FeedUrl must be a valid URL');
    }
  }
  
  return errors;
}

// Generate JWT-like signature for verification (simplified implementation)
function generateSignature(payload, secret = process.env.METABOOST_SECRET || 'default_secret') {
  const data = JSON.stringify({
    amount: payload.amount,
    feedUrl: payload.feedUrl,
    timestamp: payload.timestamp
  });
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Verify signature (for future authentication)
function verifySignature(payload, signature, secret = process.env.METABOOST_SECRET || 'default_secret') {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}

module.exports = function handler(req, res) {
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method === 'GET') {
    // Return metaBoost endpoint information
    res.status(200).json({
      name: 'V4V Lightning Payment Tester MetaBoost API',
      version: '2.0.0',
      specification: 'https://github.com/Podcastindex-org/podcast-namespace/discussions/676',
      endpoints: {
        submit: '/api/metaboost-v2',
        viewer: '/api/metaboost-viewer'
      },
      schema: METABOOST_SCHEMA,
      authentication: {
        supported: ['none', 'signature', 'api_key'],
        current: 'none'
      },
      features: [
        'payment_proof_validation',
        'json_schema_validation', 
        'cors_enabled',
        'signature_verification_ready'
      ]
    });
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ 
      error: 'Method not allowed',
      allowed: ['GET', 'POST', 'OPTIONS']
    });
    return;
  }
  
  const startTime = Date.now();
  
  try {
    // Validate request body exists
    if (!req.body) {
      res.status(400).json({
        error: 'Request body required',
        schema: METABOOST_SCHEMA
      });
      return;
    }
    
    console.log('📥 MetaBoost v2 received:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      contentLength: req.headers['content-length'],
      body: req.body
    });
    
    // Validate payload against schema
    const validationErrors = validateMetaBoost(req.body);
    if (validationErrors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        errors: validationErrors,
        schema: METABOOST_SCHEMA
      });
      return;
    }
    
    // Extract and normalize fields
    const {
      amount,
      paymentProof,
      comment,
      message,
      appName,
      username,
      senderName,
      episodeGuid,
      feedUrl,
      podcast,
      episode,
      recipients,
      paymentInfo,
      signature,
      ...additionalFields
    } = req.body;
    
    // Parse payment proof
    let parsedPaymentProof;
    try {
      parsedPaymentProof = typeof paymentProof === 'string' 
        ? JSON.parse(paymentProof) 
        : paymentProof;
    } catch (e) {
      res.status(400).json({
        error: 'Invalid payment proof JSON format'
      });
      return;
    }
    
    // Generate unique boost ID
    const boostId = req.body.boostId || `metaboost_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Create standardized metaBoost object
    const metaBoost = {
      // Core metaBoost fields
      boostId,
      version: '2.0.0',
      timestamp: req.body.timestamp || new Date().toISOString(),
      
      // Payment information
      amount,
      value_msat: parsedPaymentProof.amount_msat || (amount * 1000),
      value_msat_total: parsedPaymentProof.amount_msat || (amount * 1000),
      
      // Content information
      feedUrl,
      podcast: podcast || feedUrl,
      episode: episode || episodeGuid,
      episodeGuid,
      
      // User information  
      comment: comment || message || '',
      message: message || comment || '',
      appName: appName || 'Unknown App',
      username: username || senderName || 'Anonymous',
      senderName: senderName || username || 'Anonymous',
      
      // Payment proof (validated)
      paymentProof: parsedPaymentProof,
      
      // Additional metadata
      recipients: recipients || [],
      paymentInfo: paymentInfo || {},
      
      // Processing metadata
      processingTime: new Date().toISOString(),
      processingDuration: Date.now() - startTime,
      apiVersion: '2.0.0',
      
      // Include any additional fields
      ...additionalFields
    };
    
    // Optional signature verification
    if (signature) {
      try {
        const isValid = verifySignature(req.body, signature);
        metaBoost.signatureVerified = isValid;
        if (!isValid) {
          console.warn('⚠️ Invalid signature provided for metaBoost:', boostId);
        }
      } catch (e) {
        console.error('❌ Signature verification error:', e.message);
        metaBoost.signatureVerified = false;
      }
    }
    
    // Log successful processing
    console.log('✅ MetaBoost v2 processed successfully:', {
      boostId: metaBoost.boostId,
      amount: metaBoost.amount,
      podcast: metaBoost.podcast,
      appName: metaBoost.appName,
      processingDuration: metaBoost.processingDuration + 'ms'
    });
    
    // Store in viewer (for demo purposes)
    try {
      const viewerUrl = `https://${req.headers.host}/api/metaboost-viewer`;
      fetch(viewerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          boost: metaBoost,
          source: 'metaboost-v2'
        })
      }).catch(err => console.log('Could not update viewer:', err.message));
    } catch (e) {
      // Ignore viewer errors
      console.log('Viewer update failed:', e.message);
    }
    
    // Return success response per emerging spec
    res.status(200).json({
      status: 'success',
      message: 'MetaBoost received and processed successfully',
      data: {
        boostId: metaBoost.boostId,
        amount: metaBoost.amount,
        timestamp: metaBoost.timestamp,
        processingDuration: metaBoost.processingDuration
      },
      meta: {
        apiVersion: '2.0.0',
        specification: 'https://github.com/Podcastindex-org/podcast-namespace/discussions/676',
        processed: metaBoost.processingTime
      }
    });
    
  } catch (error) {
    console.error('❌ MetaBoost v2 processing error:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Internal server error processing metaBoost',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
      data: {
        timestamp: new Date().toISOString(),
        processingDuration: Date.now() - startTime
      }
    });
  }
};