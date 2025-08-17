// Vercel serverless function for proxy keysend payments
import crypto from 'crypto';

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
        const { destination, amount, message, nwc_string } = req.body;
        
        if (!destination || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // Check if we have NWC configured (either from request or environment)
        const nwcConnectionString = nwc_string || process.env.NWC_CONNECTION_STRING;
        
        if (!nwcConnectionString) {
            return res.status(503).json({
                success: false,
                error: 'No NWC connection available. Please provide NWC string or configure server.'
            });
        }
        
        // Parse NWC connection string
        let walletPubkey, relay, secret;
        try {
            const url = new URL(nwcConnectionString.replace('nostr+walletconnect://', 'https://'));
            walletPubkey = url.hostname;
            const params = new URLSearchParams(url.search);
            relay = params.get('relay')?.replace(/%2F/g, '/').replace(/%3A/g, ':');
            secret = params.get('secret');
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid NWC connection string format'
            });
        }
        
        // For MVP, we'll return a simulated success
        // In production, this would:
        // 1. Connect to the NWC relay
        // 2. Create an invoice for the amount
        // 3. Pay the invoice using the user's wallet
        // 4. Send keysend to destination using backend wallet
        
        console.log(`Proxy payment request: ${amount} sats to ${destination.substring(0, 16)}...`);
        
        // Generate mock payment hash
        const paymentHash = crypto.randomBytes(32).toString('hex');
        const preimage = crypto.randomBytes(32).toString('hex');
        
        // Simulate successful proxy payment
        return res.status(200).json({
            success: true,
            method: 'proxy',
            payment_hash: paymentHash,
            preimage: preimage,
            amount: amount,
            destination: destination,
            message: `Simulated proxy payment - in production this would use NWC relay: ${relay}`
        });
        
    } catch (error) {
        console.error('Error in proxy-keysend:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}