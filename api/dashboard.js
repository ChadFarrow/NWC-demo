// MetaBoost Dashboard API - New endpoint to bypass caching
// Serves dashboard on GET requests and processes metaBoost data on POST requests

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
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            min-height: 100vh;
            line-height: 1.6;
            padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
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
        .success-section {
            background: linear-gradient(45deg, #28a745, #20c997);
            border-radius: 16px;
            padding: 2rem;
            margin: 2rem 0;
            text-align: center;
        }
        .info-section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .info-section h2 { color: #f7931e; margin-bottom: 1rem; font-size: 1.8rem; }
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
        .footer { text-align: center; padding: 2rem; opacity: 0.7; margin-top: 3rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 MetaBoost Dashboard</h1>
            <p>Chad's NWC Demo - Podcasting 2.0 MetaBoost Endpoint</p>
        </div>

        <div class="success-section">
            <h2>✅ Dashboard Successfully Working!</h2>
            <p>Your MetaBoost dashboard is now live and working correctly!</p>
            <p><strong>This confirms the API endpoint deployment is successful.</strong></p>
        </div>

        <div class="info-section">
            <h2>📡 Endpoint Information</h2>
            <p>This is the working MetaBoost dashboard for Chad's NWC Demo.</p>
            
            <h3 style="color: #f7931e; margin-top: 1.5rem;">MetaBoost API Endpoint:</h3>
            <div class="endpoint-url">
                <strong>POST</strong> https://v4v-lightning-payment-tester-ec9iywsi9-chadfs-projects.vercel.app/api/metaboost
            </div>
            
            <h3 style="color: #f7931e; margin-top: 1.5rem;">Dashboard URL:</h3>
            <div class="endpoint-url">
                <strong>GET</strong> https://v4v-lightning-payment-tester-ec9iywsi9-chadfs-projects.vercel.app/api/dashboard
            </div>
        </div>

        <div class="info-section">
            <h2>📊 Your Recipients (from RSS feed)</h2>
            <div style="background: #1a1a1a; padding: 1rem; border-radius: 8px; font-family: monospace;">
                <pre>• Alby (30%) - chadf@getalby.com
• Strike (15%) - chadf@strike.me  
• Zeus Cashu (15%) - eagerheron90@zeusnuts.com
• Primal (15%) - cobaltfly1@primal.net
• My Node (15%) - 032870...
• The Wolf (5%) - 03ecb3...
• Podcast Index (5%) - 03ae9f...</pre>
            </div>
        </div>

        <div class="footer">
            <p>🚀 Powered by <strong>NWC Demo</strong></p>
            <p>✅ MetaBoost Dashboard Working Successfully!</p>
        </div>
    </div>
</body>
</html>
    `);
    return;
  }

  if (req.method === 'POST') {
    // Also handle POST requests for metaBoost data
    console.log('📥 MetaBoost received at dashboard endpoint:', req.body);
    
    const { amount, paymentProof, message } = req.body;
    
    if (!amount && !paymentProof) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'paymentProof']
      });
    }
    
    const processedBoost = {
      id: 'boost_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      amount,
      paymentProof,
      message: message || '',
      endpoint: 'dashboard',
      status: 'received'
    };
    
    console.log('✅ Processed metaBoost at dashboard:', processedBoost);
    
    res.status(200).json({ 
      status: 'success',
      message: 'MetaBoost received successfully',
      data: processedBoost
    });
    return;
  }

  res.status(405).json({ 
    error: 'Method not allowed',
    allowed: ['GET', 'POST', 'OPTIONS']
  });
};