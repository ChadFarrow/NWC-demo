// Simple in-memory storage for demo purposes
// In production, use a database
let boosts = [];

module.exports = function handler(req, res) {
  // Allow CORS from anywhere (for testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Return HTML viewer page
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>MetaBoost Viewer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #1a1a1a;
            color: #fff;
            padding: 2rem;
            margin: 0;
        }
        h1 {
            color: #0066cc;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 1rem;
        }
        .boost {
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
        }
        .boost-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            color: #0066cc;
            font-weight: bold;
        }
        .field {
            margin: 0.5rem 0;
            display: flex;
            gap: 0.5rem;
        }
        .label {
            color: #999;
            min-width: 120px;
        }
        .value {
            color: #fff;
            word-break: break-all;
        }
        .empty {
            text-align: center;
            color: #666;
            padding: 3rem;
        }
        button {
            background: #0066cc;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 0.5rem;
        }
        button:hover {
            background: #0052a3;
        }
        .controls {
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <h1>🚀 MetaBoost Viewer</h1>
    <div class="controls">
        <button onclick="location.reload()">🔄 Refresh</button>
        <button onclick="fetchBoosts()">📡 Fetch Latest</button>
        <span id="count"></span>
    </div>
    <div id="boosts"></div>
    
    <script>
        async function fetchBoosts() {
            try {
                const response = await fetch('/api/metaboost-viewer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'list' })
                });
                const data = await response.json();
                displayBoosts(data.boosts || []);
            } catch (e) {
                console.error('Failed to fetch boosts:', e);
            }
        }
        
        function displayBoosts(boosts) {
            const container = document.getElementById('boosts');
            const count = document.getElementById('count');
            
            count.textContent = \`(\${boosts.length} boosts)\`;
            
            if (boosts.length === 0) {
                container.innerHTML = '<div class="empty">No boosts received yet. Send a metaBoost to see it here!</div>';
                return;
            }
            
            container.innerHTML = boosts.map(boost => \`
                <div class="boost">
                    <div class="boost-header">
                        <span>⚡ \${boost.amount} sats</span>
                        <span>\${new Date(boost.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="field">
                        <span class="label">Boost ID:</span>
                        <span class="value">\${boost.boostId || boost.id || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Podcast:</span>
                        <span class="value">\${boost.podcast || 'Unknown'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Episode:</span>
                        <span class="value">\${boost.episode || 'Unknown'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Message:</span>
                        <span class="value">\${boost.message || 'No message'}</span>
                    </div>
                    <div class="field">
                        <span class="label">App:</span>
                        <span class="value">\${boost.appName || 'Unknown'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Sender:</span>
                        <span class="value">\${boost.senderName || 'Anonymous'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Payment Proof:</span>
                        <span class="value">
                            <details style="cursor: pointer;">
                                <summary style="color: var(--accent-primary);">Click to view payment proof</summary>
                                <pre style="background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.8em; white-space: pre-wrap; word-break: break-all;">${boost.paymentProof || 'N/A'}</pre>
                            </details>
                        </span>
                    </div>
                    <div class="field">
                        <span class="label">Recipients:</span>
                        <span class="value">${Array.isArray(boost.recipients) ? boost.recipients.join(', ') : boost.recipients || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Feed URL:</span>
                        <span class="value">${boost.feedUrl || 'N/A'}</span>
                    </div>
                    <div class="field">
                        <span class="label">Episode GUID:</span>
                        <span class="value">${boost.episodeGuid || 'N/A'}</span>
                    </div>
                </div>
            \`).join('');
        }
        
        // Load on page load
        fetchBoosts();
    </script>
</body>
</html>
    `;
    
    res.status(200).setHeader('Content-Type', 'text/html').send(html);
    return;
  }
  
  if (req.method === 'POST') {
    const { action, boost } = req.body;
    
    if (action === 'add' && boost) {
      // Add new boost (called from metaboost.js)
      boosts.unshift(boost);
      // Keep only last 50 boosts
      if (boosts.length > 50) {
        boosts = boosts.slice(0, 50);
      }
      res.status(200).json({ status: 'ok', total: boosts.length });
    } else if (action === 'list') {
      // Return list of boosts
      res.status(200).json({ boosts });
    } else if (action === 'clear') {
      // Clear all boosts
      boosts = [];
      res.status(200).json({ status: 'cleared' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
    return;
  }
  
  res.status(405).json({ error: 'Method not allowed' });
}