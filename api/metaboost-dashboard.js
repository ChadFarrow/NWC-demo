// Enhanced MetaBoost Dashboard API
// Serves a beautiful dashboard on GET requests
// Processes metaBoost data on POST requests

module.exports = function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Serve the MetaBoost Dashboard
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚀 MetaBoost Dashboard - Chad's V4V Lightning Tester</title>
    <meta name="description" content="MetaBoost endpoint for Chad's NWC Demo - Podcasting 2.0 compliant">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            min-height: 100vh;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem;
            background: linear-gradient(45deg, #ff6b35, #f7931e);
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(255, 107, 53, 0.3);
        }
        
        .header h1 {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 2rem;
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }
        
        .stat-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
        }
        
        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            color: #f7931e;
            margin-bottom: 0.5rem;
        }
        
        .stat-label {
            font-size: 1.1rem;
            opacity: 0.8;
        }
        
        .info-section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .info-section h2 {
            color: #f7931e;
            margin-bottom: 1rem;
            font-size: 1.8rem;
        }
        
        .endpoint-url {
            background: #2d2d2d;
            padding: 1rem;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
            border: 1px solid #444;
            margin: 1rem 0;
            word-break: break-all;
        }
        
        .code-block {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1rem 0;
            overflow-x: auto;
        }
        
        .code-block pre {
            color: #e6e6e6;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.85rem;
            line-height: 1.5;
        }
        
        .highlight {
            color: #f7931e;
            font-weight: 600;
        }
        
        .success {
            color: #00ff88;
        }
        
        .links-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-top: 2rem;
        }
        
        .link-card {
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            text-decoration: none;
            color: white;
            transition: transform 0.3s ease;
        }
        
        .link-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }
        
        .link-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            display: block;
        }
        
        .pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            opacity: 0.7;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin-top: 3rem;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            .stats-grid {
                grid-template-columns: 1fr;
            }
            .container {
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 MetaBoost Dashboard</h1>
            <p>Chad's NWC Demo - Podcasting 2.0 MetaBoost Endpoint</p>
            <p class="pulse">✨ Live and Ready to Receive Boosts!</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-icon">⚡</span>
                <div class="stat-number" id="total-boosts">0</div>
                <div class="stat-label">Total MetaBoosts</div>
            </div>
            
            <div class="stat-card">
                <span class="stat-icon">💎</span>
                <div class="stat-number" id="total-sats">0</div>
                <div class="stat-label">Total Sats Boosted</div>
            </div>
            
            <div class="stat-card">
                <span class="stat-icon">🎵</span>
                <div class="stat-number">7</div>
                <div class="stat-label">Active Recipients</div>
            </div>
            
            <div class="stat-card">
                <span class="stat-icon">🔥</span>
                <div class="stat-number success">LIVE</div>
                <div class="stat-label">Endpoint Status</div>
            </div>
        </div>

        <div class="info-section">
            <h2>📡 Endpoint Information</h2>
            <p>This is the official MetaBoost endpoint for Chad's NWC Demo, fully compliant with the <strong>Podcasting 2.0 MetaBoost specification</strong>.</p>
            
            <h3 style="color: #f7931e; margin-top: 1.5rem;">Endpoint URL:</h3>
            <div class="endpoint-url">
                <strong>POST</strong> https://v4v-lightning-payment-tester-ec9iywsi9-chadfs-projects.vercel.app/api/metaboost
            </div>
            
            <p>Podcast apps supporting MetaBoost will automatically send payment metadata to this endpoint when listeners boost your podcast.</p>
        </div>

        <div class="info-section">
            <h2>🎯 How It Works</h2>
            <ol style="padding-left: 2rem; line-height: 2;">
                <li><strong>RSS Feed Integration:</strong> Your podcast feed contains this MetaBoost endpoint URL</li>
                <li><strong>Listener Boosts:</strong> When someone sends a Lightning payment via a Podcasting 2.0 app</li>
                <li><strong>Metadata Delivery:</strong> The app sends boost details, payment proof, and message to this endpoint</li>
                <li><strong>Real-time Processing:</strong> Your endpoint receives and processes the MetaBoost data instantly</li>
            </ol>
        </div>

        <div class="info-section">
            <h2>📊 Supported Apps & Recipients</h2>
            <p><strong>Compatible Apps:</strong> Fountain, Podverse, CurioCaster, and other Podcasting 2.0 apps</p>
            
            <p><strong>Your Recipients (from RSS feed):</strong></p>
            <div class="code-block">
                <pre>• Alby (30%) - chadf@getalby.com
• Strike (15%) - chadf@strike.me  
• Zeus Cashu (15%) - eagerheron90@zeusnuts.com
• Primal (15%) - cobaltfly1@primal.net
• My Node (15%) - 032870...
• The Wolf (5%) - 03ecb3...
• Podcast Index (5%) - 03ae9f...</pre>
            </div>
        </div>

        <div class="info-section">
            <h2>🧪 Example MetaBoost Data</h2>
            <p>Here's what gets sent to this endpoint when someone boosts your podcast:</p>
            
            <div class="code-block">
                <pre>{
  "<span class="highlight">amount</span>": 21,
  "<span class="highlight">paymentProof</span>": {
    "type": "keysend",
    "success": true,
    "payment_hash": "abc123...",
    "amount_sats": 21
  },
  "<span class="highlight">message</span>": "Great episode! Love the content!",
  "<span class="highlight">podcast</span>": "LNURL Testing Podcast",
  "<span class="highlight">episode</span>": "Lightning Network Integration",
  "<span class="highlight">appName</span>": "Fountain",
  "<span class="highlight">senderName</span>": "Anonymous Listener",
  "<span class="highlight">recipients</span>": ["chadf@getalby.com", "chadf@strike.me"],
  "<span class="highlight">timestamp</span>": "2025-08-10T21:00:00.000Z"
}</pre>
            </div>
        </div>

        <div class="links-grid">
            <a href="https://github.com/Podcastindex-org/podcast-namespace/discussions/676" class="link-card" target="_blank">
                <span class="link-icon">📖</span>
                <div>MetaBoost Specification</div>
            </a>
            
            <a href="https://raw.githubusercontent.com/ChadFarrow/lnurl-test-feed/main/public/lnurl-test-feed.xml" class="link-card" target="_blank">
                <span class="link-icon">📡</span>
                <div>RSS Feed with MetaBoost</div>
            </a>
            
            <a href="https://github.com/ChadFarrow/nwc-demo" class="link-card" target="_blank">
                <span class="link-icon">💻</span>
                <div>Source Code</div>
            </a>
        </div>

        <div class="footer">
            <p>🚀 Powered by <strong>NWC Demo</strong></p>
            <p>MetaBoost Dashboard • Podcasting 2.0 Compatible • Built with ⚡ by Chad</p>
        </div>
    </div>

    <script>
        // Real-time stats (placeholder - would connect to actual data in production)
        function updateStats() {
            // These would be real stats from your backend
            const stats = {
                totalBoosts: Math.floor(Math.random() * 50) + 10,
                totalSats: Math.floor(Math.random() * 10000) + 1000
            };
            
            document.getElementById('total-boosts').textContent = stats.totalBoosts;
            document.getElementById('total-sats').textContent = stats.totalSats.toLocaleString();
        }
        
        // Update stats on page load
        updateStats();
        
        console.log('🚀 MetaBoost Dashboard loaded!');
        console.log('📡 Endpoint ready to receive MetaBoosts');
        console.log('⚡ Podcasting 2.0 compatible');
    </script>
</body>
</html>
    `);
    return;
  }

  if (req.method === 'POST') {
    console.log('📥 MetaBoost received:', req.body);
    
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
      id: boostId || \`boost_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
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
      processingTime: new Date().toISOString(),
      endpoint: 'metaboost-dashboard',
      version: '2.0.0'
    };
    
    // Log for debugging
    console.log('✅ Processed metaBoost:', processedBoost);
    
    // Return enhanced success response per spec
    res.status(200).json({ 
      status: 'success',
      message: 'MetaBoost received and processed successfully',
      data: {
        boostId: processedBoost.id,
        amount: processedBoost.amount,
        timestamp: processedBoost.timestamp,
        podcast: processedBoost.podcast
      },
      meta: {
        endpoint: 'NWC Demo MetaBoost Dashboard',
        version: '2.0.0',
        specification: 'https://github.com/Podcastindex-org/podcast-namespace/discussions/676',
        processed: processedBoost.processingTime
      },
      debug: process.env.NODE_ENV === 'development' ? processedBoost : undefined
    });
  } else {
    res.status(405).json({ 
      error: 'Method not allowed',
      allowed: ['GET', 'POST', 'OPTIONS'],
      message: 'Use GET to view dashboard, POST to send MetaBoost data'
    });
  }
};