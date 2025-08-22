// Vercel serverless function for NWC keysend
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { nwc_string, destination, amount, message } = req.body;
        
        // For now, return that keysend is not supported
        // This will trigger the proxy fallback
        return res.status(200).json({
            success: false,
            error: 'Keysend not supported',
            needsProxy: true
        });
        
    } catch (error) {
        console.error('Error in nwc-keysend:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}