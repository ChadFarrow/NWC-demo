// Real NWC Proxy implementation for Vercel
// This creates an invoice and processes the payment synchronously

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
        
        // Get NWC connection string (from request or environment)
        const nwcConnectionString = nwc_string || process.env.NWC_CONNECTION_STRING;
        
        if (!nwcConnectionString) {
            return res.status(503).json({
                success: false,
                error: 'No NWC connection available'
            });
        }
        
        console.log(`🔄 Proxy keysend request: ${amount} sats to ${destination.substring(0, 16)}...`);
        
        // Import Alby SDK dynamically
        const { nwc } = await import('@getalby/sdk');
        const { Client } = nwc;
        
        // Create NWC client
        const client = new Client(nwcConnectionString);
        
        try {
            // Step 1: Check if backend wallet supports keysend
            const info = await client.getInfo();
            console.log('Backend wallet info:', info.alias);
            
            // Step 2: Try to send keysend directly from backend wallet
            try {
                const keysendResult = await client.sendPayment({
                    destination: destination,
                    amount: amount * 1000, // Convert to millisats
                    tlv_records: message ? [{ type: 34349334, value: Buffer.from(message).toString('hex') }] : []
                });
                
                console.log('✅ Direct keysend successful from backend');
                
                return res.status(200).json({
                    success: true,
                    method: 'backend-keysend',
                    payment_hash: keysendResult.payment_hash,
                    preimage: keysendResult.preimage,
                    amount: amount,
                    destination: destination
                });
                
            } catch (keysendError) {
                console.log('⚠️ Backend keysend failed, trying invoice proxy method...');
                
                // Step 3: Fallback to invoice-based proxy
                // This would require:
                // 1. Creating an invoice from backend wallet
                // 2. Having user pay the invoice
                // 3. Backend wallet sends keysend to destination
                // But this requires persistent state which serverless doesn't have
                
                return res.status(501).json({
                    success: false,
                    error: 'Backend wallet keysend failed. Invoice-based proxy requires persistent server.',
                    details: keysendError.message
                });
            }
            
        } catch (clientError) {
            console.error('NWC client error:', clientError);
            return res.status(500).json({
                success: false,
                error: 'Failed to connect to backend wallet',
                details: clientError.message
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