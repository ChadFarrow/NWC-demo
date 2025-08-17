// Simple endpoint to check backend wallet capabilities
import 'websocket-polyfill';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const nwcString = process.env.NWC_CONNECTION_STRING;
        
        if (!nwcString) {
            return res.json({ error: 'No NWC configured' });
        }
        
        const { NWCClient } = await import('@getalby/sdk');
        const client = new NWCClient({ nostrWalletConnectUrl: nwcString });
        
        const info = await client.getInfo();
        
        return res.json({
            success: true,
            methods: info.methods || [],
            alias: info.alias || 'Unknown',
            supports_keysend: (info.methods || []).includes('pay_keysend'),
            relay: nwcString.includes('relay=') ? nwcString.split('relay=')[1].split('&')[0] : 'Unknown'
        });
        
    } catch (error) {
        return res.json({ 
            error: error.message,
            success: false
        });
    }
}