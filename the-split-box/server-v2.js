// The Split Box Server V2 - Production Ready
// Keysend proxy using NWC to your AlbyHub

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const NWCClient = require('./nwc-client');

const app = express();

// Configure CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// Initialize NWC client
let nwcClient = null;
if (process.env.NWC_CONNECTION_STRING) {
    try {
        nwcClient = new NWCClient(process.env.NWC_CONNECTION_STRING);
        console.log('✅ NWC Client initialized with relay:', nwcClient.relay);
    } catch (error) {
        console.error('❌ Failed to initialize NWC client:', error.message);
    }
} else {
    console.warn('⚠️  No NWC_CONNECTION_STRING provided. Set it in .env file');
}

// Store invoice mappings
const invoiceMap = new Map();

// Create proxy invoice endpoint
app.post('/api/createInvoice', async (req, res) => {
    try {
        const { destination, amount, message } = req.body;
        
        // Validate inputs
        if (!destination || !amount) {
            return res.status(400).json({
                error: 'Missing required fields: destination and amount'
            });
        }
        
        if (!nwcClient) {
            return res.status(500).json({
                error: 'Proxy server not configured. Contact administrator.'
            });
        }
        
        console.log(`\n📥 Creating proxy invoice:`);
        console.log(`   Amount: ${amount} sats`);
        console.log(`   Destination: ${destination.substring(0, 20)}...`);
        console.log(`   Message: ${message || 'none'}`);
        
        // Create invoice via NWC
        const description = `TSB Proxy: ${message || 'Keysend forward'}`;
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
        
        console.log(`✅ Invoice created: ${invoice.substring(0, 50)}...`);
        console.log(`   Tracking ID: ${trackingId}`);
        
        // Start monitoring for payment
        monitorInvoice(invoice);
        
        res.json({
            success: true,
            invoice,
            tracking_id: trackingId,
            expires_at: Date.now() + (10 * 60 * 1000) // 10 minutes
        });
        
    } catch (error) {
        console.error('❌ Error creating invoice:', error);
        res.status(500).json({
            error: 'Failed to create invoice: ' + error.message
        });
    }
});

// Monitor invoice for payment
async function monitorInvoice(invoice) {
    const data = invoiceMap.get(invoice);
    if (!data) return;
    
    console.log(`\n👀 Monitoring invoice for payment...`);
    
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes at 2 second intervals
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        try {
            const invoiceStatus = await nwcClient.lookupInvoice(invoice);
            
            if (invoiceStatus && invoiceStatus.settled) {
                clearInterval(checkInterval);
                
                console.log(`\n💰 Invoice PAID! Processing keysend forward...`);
                data.status = 'processing';
                invoiceMap.set(invoice, data);
                
                // Forward as keysend
                try {
                    const result = await nwcClient.payKeysend(
                        data.destination,
                        data.amount,
                        data.message || ''
                    );
                    
                    console.log(`✅ Keysend forwarded successfully!`);
                    console.log(`   Payment hash: ${result.payment_hash || 'N/A'}`);
                    
                    data.status = 'completed';
                    data.completedAt = Date.now();
                    data.paymentHash = result.payment_hash;
                    invoiceMap.set(invoice, data);
                    
                } catch (keysendError) {
                    console.error(`❌ Keysend forward failed:`, keysendError.message);
                    data.status = 'failed';
                    data.error = keysendError.message;
                    invoiceMap.set(invoice, data);
                }
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log(`⏱️  Invoice monitoring timeout for ${invoice.substring(0, 20)}...`);
                data.status = 'expired';
                invoiceMap.set(invoice, data);
            }
            
        } catch (error) {
            console.error('Error checking invoice:', error.message);
        }
    }, 2000); // Check every 2 seconds
    
    // Clean up old data after 1 hour
    setTimeout(() => {
        invoiceMap.delete(invoice);
    }, 60 * 60 * 1000);
}

// Get status endpoint
app.get('/api/status/:trackingId', (req, res) => {
    const { trackingId } = req.params;
    
    // Find invoice by tracking ID
    let invoiceData = null;
    for (const [invoice, data] of invoiceMap.entries()) {
        if (data.trackingId === trackingId) {
            invoiceData = data;
            break;
        }
    }
    
    if (!invoiceData) {
        return res.status(404).json({
            error: 'Invoice not found'
        });
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'The Split Box',
        nwc_configured: !!nwcClient,
        active_invoices: invoiceMap.size,
        uptime: process.uptime()
    });
});

// Info endpoint
app.get('/api/info', async (req, res) => {
    if (!nwcClient) {
        return res.json({
            configured: false,
            message: 'NWC not configured'
        });
    }
    
    try {
        // You could add wallet info here if needed
        res.json({
            configured: true,
            relay: nwcClient.relay,
            pubkey: nwcClient.pubkey,
            supported_methods: ['pay_keysend', 'make_invoice', 'lookup_invoice']
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Start server
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`\n🚀 The Split Box - Keysend Proxy Server`);
    console.log(`📡 Running on port ${PORT}`);
    console.log(`🔗 NWC Status: ${nwcClient ? 'Connected' : 'Not configured'}`);
    
    if (!nwcClient) {
        console.log(`\n⚠️  To configure NWC:`);
        console.log(`1. Copy .env.example to .env`);
        console.log(`2. Add your AlbyHub NWC connection string`);
        console.log(`3. Restart the server`);
    } else {
        console.log(`\n✅ Ready to proxy keysend payments!`);
        console.log(`   Endpoint: POST http://localhost:${PORT}/api/createInvoice`);
    }
});