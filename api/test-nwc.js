// Test endpoint to verify NWC connection
import 'websocket-polyfill';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const nwcString = process.env.NWC_CONNECTION_STRING;
        
        if (!nwcString) {
            return res.status(503).json({
                success: false,
                error: 'NWC_CONNECTION_STRING not configured in environment'
            });
        }
        
        // Parse the connection string
        let relay, walletPubkey;
        try {
            const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
            walletPubkey = url.hostname;
            const params = new URLSearchParams(url.search);
            relay = params.get('relay')?.replace(/%2F/g, '/').replace(/%3A/g, ':');
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Invalid NWC connection string format'
            });
        }
        
        // Try to connect and get wallet info
        try {
            const { webln } = await import('@getalby/sdk');
            const { NostrWebLNProvider } = webln;
            
            const provider = new NostrWebLNProvider({
                nostrWalletConnectUrl: nwcString
            });
            
            await provider.enable();
            const info = await provider.getInfo();
            
            return res.status(200).json({
                success: true,
                wallet_configured: true,
                relay: relay,
                wallet_pubkey: walletPubkey,
                wallet_info: {
                    alias: info.alias || 'Unknown',
                    methods: info.methods || [],
                    supports_keysend: info.methods?.includes('keysend') || false
                }
            });
            
        } catch (connectionError) {
            return res.status(500).json({
                success: false,
                error: 'Failed to connect to wallet',
                details: connectionError.message,
                relay: relay,
                wallet_pubkey: walletPubkey
            });
        }
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}