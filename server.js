// NWC Demo Server with Integrated Split Box Proxy
// Serves the frontend and transparently handles keysend proxy routing

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: './the-split-box/.env' });

// Import The Split Box NWC client
const NWCClient = require('./the-split-box/nwc-client');

const app = express();
const PORT = 3003; // Always use 3003 for main server

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Initialize NWC client for proxy if configured
let nwcClient = null;
if (process.env.NWC_CONNECTION_STRING) {
    try {
        nwcClient = new NWCClient(process.env.NWC_CONNECTION_STRING);
        console.log('✅ Split Box proxy enabled with NWC relay:', nwcClient.relay);
    } catch (error) {
        console.error('⚠️  Split Box proxy disabled - NWC error:', error.message);
    }
} else {
    console.log('ℹ️  Split Box proxy disabled - no NWC connection configured');
}

// Store invoice mappings for proxy
const invoiceMap = new Map();

// API endpoint for transparent keysend proxy
app.post('/api/proxy/keysend', async (req, res) => {
    try {
        const { destination, amount, message, walletSupportsKeysend } = req.body;
        
        // If wallet supports keysend, just return success (frontend handles it)
        if (walletSupportsKeysend) {
            return res.json({
                success: true,
                method: 'direct_keysend',
                message: 'Use direct keysend from wallet'
            });
        }
        
        // If no proxy configured, return error
        if (!nwcClient) {
            return res.status(501).json({
                success: false,
                error: 'Keysend proxy not configured. Wallet does not support keysend.'
            });
        }
        
        // Validate inputs
        if (!destination || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: destination and amount'
            });
        }
        
        console.log(`\n🔄 Proxy keysend request:`);
        console.log(`   Amount: ${amount} sats`);
        console.log(`   Destination: ${destination.substring(0, 20)}...`);
        
        // Create invoice via NWC
        const description = `V4V Payment: ${message || 'Podcast support'}`;
        const invoice = await nwcClient.makeInvoice(amount, description);
        
        // Generate tracking ID
        const trackingId = crypto.randomBytes(16).toString('hex');
        
        // Store the mapping
        invoiceMap.set(invoice, {
            trackingId,
            destination,
            amount,
            message,
            status: 'pending',
            createdAt: Date.now(),
            invoice
        });
        
        console.log(`✅ Proxy invoice created`);
        
        // Start monitoring for payment
        monitorAndForward(invoice);
        
        res.json({
            success: true,
            method: 'proxy',
            invoice,
            tracking_id: trackingId
        });
        
    } catch (error) {
        console.error('❌ Proxy error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Monitor invoice and forward as keysend
async function monitorAndForward(invoice) {
    const data = invoiceMap.get(invoice);
    if (!data) return;
    
    console.log(`👀 Monitoring proxy invoice...`);
    
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        try {
            const invoiceStatus = await nwcClient.lookupInvoice(invoice);
            
            if (invoiceStatus && invoiceStatus.settled) {
                clearInterval(checkInterval);
                
                console.log(`💰 Invoice paid! Forwarding keysend...`);
                data.status = 'processing';
                
                try {
                    const result = await nwcClient.payKeysend(
                        data.destination,
                        data.amount,
                        data.message || ''
                    );
                    
                    console.log(`✅ Keysend forwarded successfully!`);
                    data.status = 'completed';
                    data.paymentHash = result.payment_hash;
                    
                } catch (keysendError) {
                    console.error(`❌ Keysend forward failed:`, keysendError.message);
                    data.status = 'failed';
                    data.error = keysendError.message;
                }
                
                invoiceMap.set(invoice, data);
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log(`⏱️  Invoice expired`);
                data.status = 'expired';
                invoiceMap.set(invoice, data);
            }
            
        } catch (error) {
            console.error('Error checking invoice:', error.message);
        }
    }, 2000);
    
    // Clean up after 1 hour
    setTimeout(() => {
        invoiceMap.delete(invoice);
    }, 60 * 60 * 1000);
}

// Check proxy payment status
app.get('/api/proxy/status/:trackingId', (req, res) => {
    const { trackingId } = req.params;
    
    let invoiceData = null;
    for (const [invoice, data] of invoiceMap.entries()) {
        if (data.trackingId === trackingId) {
            invoiceData = data;
            break;
        }
    }
    
    if (!invoiceData) {
        return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json({
        tracking_id: trackingId,
        status: invoiceData.status,
        amount: invoiceData.amount,
        created_at: invoiceData.createdAt,
        completed_at: invoiceData.completedAt,
        payment_hash: invoiceData.paymentHash
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'NWC Demo Server',
        proxy_enabled: !!nwcClient,
        active_invoices: invoiceMap.size,
        uptime: process.uptime()
    });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'v4v_lightning_tester.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 NWC Demo Server`);
    console.log(`📡 Running on http://localhost:${PORT}`);
    console.log(`🔌 Split Box Proxy: ${nwcClient ? 'Enabled' : 'Disabled'}`);
    
    if (!nwcClient) {
        console.log(`\nℹ️  To enable transparent keysend proxy:`);
        console.log(`1. Add NWC_CONNECTION_STRING to the-split-box/.env`);
        console.log(`2. Restart the server`);
    }
});