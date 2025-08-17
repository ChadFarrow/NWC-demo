// Vercel serverless function for proxy keysend payments
import crypto from 'crypto';

// Store invoice mappings (in production, use a database)
const invoiceMap = new Map();

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
        const { destination, amount, message } = req.body;
        
        if (!destination || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // Check if we have NWC configured in environment
        const nwcString = process.env.NWC_CONNECTION_STRING;
        
        if (!nwcString) {
            return res.status(503).json({
                success: false,
                error: 'Proxy service not configured. Please set NWC_CONNECTION_STRING in Vercel environment variables.'
            });
        }
        
        // Generate tracking ID
        const trackingId = crypto.randomBytes(16).toString('hex');
        
        // For now, return a mock response
        // In production, this would create an invoice and handle the proxy
        return res.status(200).json({
            success: false,
            error: 'Proxy keysend endpoint needs full implementation with NWC client',
            tracking_id: trackingId,
            message: 'This endpoint requires the full NWC client implementation to work'
        });
        
    } catch (error) {
        console.error('Error in proxy-keysend:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}