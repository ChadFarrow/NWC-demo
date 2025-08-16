// NWC Demo Server with Integrated Split Box Proxy
// Serves the frontend and transparently handles keysend proxy routing

require('websocket-polyfill'); // Required for Alby SDK
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

// Serve nwcjs.js from root directory
app.get('/nwcjs.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'nwcjs.js'));
});

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
        
        // Create invoice via NWC with better error handling
        const description = `V4V Payment: ${message || 'Podcast support'}`;
        console.log(`🔄 Creating invoice via AlbyHub NWC...`);
        
        let invoice;
        try {
            // Use Alby SDK directly instead of our wrapper
            const { NWCClient } = await import('@getalby/sdk');
            const directNWC = new NWCClient({ 
                nostrWalletConnectUrl: process.env.NWC_CONNECTION_STRING 
            });
            
            const result = await directNWC.makeInvoice({
                amount: amount * 1000, // Convert to millisats
                description
            });
            
            invoice = result.invoice;
            console.log(`✅ Invoice created successfully`);
            
        } catch (nwcError) {
            console.error(`❌ NWC invoice creation failed:`, nwcError.message);
            throw new Error(`Failed to create invoice via AlbyHub: ${nwcError.message}`);
        }
        
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
    console.log(`   Invoice: ${invoice.substring(0, 50)}...`);
    console.log(`   Destination: ${data.destination}`);
    console.log(`   Amount: ${data.amount} sats`);
    
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        if (attempts % 10 === 1) {  // Log every 10 attempts
            console.log(`🔍 Check attempt ${attempts}/${maxAttempts}...`);
        }
        
        try {
            // Use Alby SDK directly for invoice lookup
            const { NWCClient } = await import('@getalby/sdk');
            const directNWC = new NWCClient({ 
                nostrWalletConnectUrl: process.env.NWC_CONNECTION_STRING 
            });
            
            const invoiceStatus = await directNWC.lookupInvoice({ invoice });
            
            if (invoiceStatus) {
                console.log(`📊 Invoice status:`, {
                    settled: invoiceStatus.settled,
                    state: invoiceStatus.state,
                    paid: invoiceStatus.paid,
                    status_type: typeof invoiceStatus.settled
                });
            }
            
            // Check multiple possible fields for payment status
            const isPaid = invoiceStatus && (
                invoiceStatus.settled === true || 
                invoiceStatus.settled === 'true' ||
                invoiceStatus.state === 'SETTLED' ||
                invoiceStatus.state === 'settled' ||  // Add lowercase check
                invoiceStatus.paid === true ||
                invoiceStatus.paid === 'true'
            );
            
            if (isPaid) {
                clearInterval(checkInterval);
                
                console.log(`💰 Invoice PAID! Forwarding keysend now...`);
                data.status = 'processing';
                
                try {
                    // Use Alby SDK directly for keysend
                    const { NWCClient } = await import('@getalby/sdk');
                    const directNWC = new NWCClient({ 
                        nostrWalletConnectUrl: process.env.NWC_CONNECTION_STRING 
                    });
                    
                    const result = await directNWC.payKeysend({
                        pubkey: data.destination,
                        amount: data.amount * 1000, // Convert to millisats
                        tlv_records: data.message ? [{
                            type: 34349334, // Standard message TLV record type
                            value: Buffer.from(data.message, 'utf8').toString('hex')
                        }] : []
                    });
                    
                    console.log(`✅ Keysend forwarded successfully!`);
                    console.log(`   Payment hash: ${result.payment_hash || 'N/A'}`);
                    data.status = 'completed';
                    data.paymentHash = result.payment_hash;
                    
                } catch (keysendError) {
                    console.error(`❌ Keysend forward failed:`, keysendError);
                    data.status = 'failed';
                    data.error = keysendError.message;
                }
                
                invoiceMap.set(invoice, data);
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log(`⏱️  Invoice expired after ${attempts} checks`);
                data.status = 'expired';
                invoiceMap.set(invoice, data);
            }
            
        } catch (error) {
            console.error('❌ Error checking invoice:', error);
        }
    }, 2000);
    
    // Clean up after 1 hour
    setTimeout(() => {
        invoiceMap.delete(invoice);
    }, 60 * 60 * 1000);
}

// NWC Bridge API endpoints using Alby SDK
app.post('/api/nwc/pay-invoice', async (req, res) => {
    try {
        const { nwc_string, invoice } = req.body;
        
        if (!nwc_string || !invoice) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // Import Alby SDK dynamically
        const { NostrWebLNProvider } = await import('@getalby/sdk');
        
        // Create NWC provider
        const nwc = new NostrWebLNProvider({ 
            nostrWalletConnectUrl: nwc_string 
        });
        
        await nwc.enable();
        
        // Pay invoice
        const result = await nwc.sendPayment(invoice);
        
        nwc.close();
        
        res.json({
            success: true,
            payment_hash: result.payment_hash,
            preimage: result.preimage
        });
        
    } catch (error) {
        console.error('❌ NWC pay invoice error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/nwc/keysend', async (req, res) => {
    try {
        const { nwc_string, destination, amount, message } = req.body;
        
        if (!nwc_string || !destination || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // Import Alby SDK dynamically
        const { NostrWebLNProvider } = await import('@getalby/sdk');
        
        // Create NWC provider
        const nwc = new NostrWebLNProvider({ 
            nostrWalletConnectUrl: nwc_string 
        });
        
        await nwc.enable();
        
        // Try keysend
        const result = await nwc.keysend({
            destination: destination,
            amount: amount * 1000, // Convert to millisats
            customRecords: message ? { '34349334': message } : {}
        });
        
        nwc.close();
        
        res.json({
            success: true,
            payment_hash: result.payment_hash,
            preimage: result.preimage
        });
        
    } catch (error) {
        console.error('❌ NWC keysend error:', error);
        // Return error but don't fail - let client fall back to proxy
        res.json({
            success: false,
            error: error.message,
            keysend_supported: false
        });
    }
});

app.post('/api/nwc/info', async (req, res) => {
    try {
        const { nwc_string } = req.body;
        
        if (!nwc_string) {
            return res.status(400).json({
                success: false,
                error: 'Missing NWC connection string'
            });
        }
        
        // Import Alby SDK dynamically
        const { NostrWebLNProvider } = await import('@getalby/sdk');
        
        // Create NWC provider
        const nwc = new NostrWebLNProvider({ 
            nostrWalletConnectUrl: nwc_string 
        });
        
        await nwc.enable();
        
        // Get wallet info
        const info = await nwc.getInfo();
        
        nwc.close();
        
        res.json({
            success: true,
            ...info
        });
        
    } catch (error) {
        console.error('❌ NWC info error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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

// Test NWC connection endpoint
app.get('/api/test-nwc', async (req, res) => {
    if (!nwcClient) {
        return res.json({
            success: false,
            error: 'NWC not configured'
        });
    }
    
    try {
        console.log('🧪 Testing NWC connection to AlbyHub...');
        
        // Try to create a minimal invoice as a connection test
        const testInvoice = await Promise.race([
            nwcClient.makeInvoice(1, 'NWC Connection Test'),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('NWC test timeout after 10 seconds')), 10000)
            )
        ]);
        
        console.log('✅ NWC connection test successful!');
        
        res.json({
            success: true,
            message: 'NWC connection working',
            relay: nwcClient.relay,
            test_invoice: testInvoice.substring(0, 20) + '...'
        });
        
    } catch (error) {
        console.error('❌ NWC connection test failed:', error.message);
        res.json({
            success: false,
            error: error.message,
            relay: nwcClient.relay,
            troubleshooting: {
                'Check AlbyHub': 'Make sure your AlbyHub is running and accessible',
                'Check relay': 'Verify relay is reachable: ' + nwcClient.relay,
                'Check permissions': 'Ensure NWC connection has make_invoice permission',
                'Check connection string': 'Verify NWC_CONNECTION_STRING in .env is correct'
            }
        });
    }
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