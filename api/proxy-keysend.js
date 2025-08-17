// Vercel serverless function for proxy keysend payments
// Uses websocket-polyfill for Vercel compatibility
import 'websocket-polyfill';

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
        
        // Get backend NWC string from environment
        const backendNWC = process.env.NWC_CONNECTION_STRING;
        
        if (!backendNWC) {
            return res.status(503).json({
                success: false,
                error: 'Backend wallet not configured. Please set NWC_CONNECTION_STRING in Vercel environment.'
            });
        }
        
        console.log(`🔄 Proxy keysend: ${amount} sats to ${destination.substring(0, 16)}...`);
        
        try {
            // Dynamically import the webln provider
            const { webln } = await import('@getalby/sdk');
            const { NostrWebLNProvider } = webln;
            
            console.log('Creating NWC provider...');
            
            // Create provider with backend NWC
            const provider = new NostrWebLNProvider({
                nostrWalletConnectUrl: backendNWC
            });
            
            console.log('Enabling provider...');
            await provider.enable();
            
            // Get wallet info to check capabilities
            console.log('Getting wallet info...');
            const info = await provider.getInfo();
            console.log('Wallet info:', info);
            
            // Try to send keysend from backend wallet
            const keysendResult = await provider.keysend({
                destination: destination,
                amount: amount,
                customRecords: message ? { 34349334: message } : {}
            });
            
            console.log('✅ Keysend successful via backend wallet');
            
            return res.status(200).json({
                success: true,
                method: 'proxy-keysend',
                payment_hash: keysendResult.payment_hash || keysendResult.paymentHash,
                preimage: keysendResult.preimage,
                amount: amount,
                destination: destination
            });
            
        } catch (keysendError) {
            console.error('Keysend error:', keysendError);
            
            // Check if it's a method not supported error
            const errorMessage = keysendError.message || keysendError.toString() || 'Unknown error';
            const isNotSupported = errorMessage.includes('not supported') || 
                                  errorMessage.includes('not implemented') ||
                                  errorMessage.includes('NOT_IMPLEMENTED');
            
            // If keysend fails, return detailed error
            return res.status(500).json({
                success: false,
                error: 'Backend wallet keysend failed',
                details: errorMessage,
                keysend_not_supported: isNotSupported,
                suggestion: isNotSupported ? 
                    'The backend wallet does not support keysend. You need an AlbyHub or wallet that supports keysend for the proxy to work.' :
                    'Check the backend wallet connection and balance.'
            });
        }
        
    } catch (error) {
        console.error('Error in proxy-keysend:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}