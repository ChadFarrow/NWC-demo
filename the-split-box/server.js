// The Split Box - Keysend Proxy Server
// Routes regular Lightning payments through NWC to perform keysend

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const WebSocket = require('ws');
const { bech32 } = require('bech32');

const app = express();
app.use(cors());
app.use(express.json());

// Store your AlbyHub NWC connection string here
const NWC_CONNECTION_STRING = process.env.NWC_CONNECTION_STRING || '';

// Parse NWC connection string
function parseNWCString(nwcString) {
    if (!nwcString.startsWith('nostr+walletconnect://')) {
        throw new Error('Invalid NWC connection string');
    }
    
    const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
    const walletPubkey = url.hostname;
    const params = new URLSearchParams(url.search);
    
    return {
        walletPubkey,
        relay: params.get('relay').replace(/%2F/g, '/').replace(/%3A/g, ':'),
        secret: params.get('secret')
    };
}

// Store pending invoices and their destinations
const pendingInvoices = new Map();

// Initialize NWC connection
let nwcConfig = null;
if (NWC_CONNECTION_STRING) {
    try {
        nwcConfig = parseNWCString(NWC_CONNECTION_STRING);
        console.log('✅ NWC configured with relay:', nwcConfig.relay);
    } catch (error) {
        console.error('❌ Failed to parse NWC connection string:', error);
    }
}

// Create invoice endpoint
app.post('/api/createInvoice', async (req, res) => {
    try {
        const { destination, amount, message } = req.body;
        
        if (!destination || !amount) {
            return res.status(400).json({ 
                error: 'Missing required fields: destination, amount' 
            });
        }
        
        console.log(`📥 Creating invoice for ${amount} sats to forward to ${destination.substring(0, 16)}...`);
        
        // Generate a unique payment hash for tracking
        const paymentHash = crypto.randomBytes(32).toString('hex');
        
        // Create invoice using NWC make_invoice
        const invoice = await createNWCInvoice(amount, `Split Box: ${message || 'Keysend proxy payment'}`);
        
        // Store the mapping
        pendingInvoices.set(paymentHash, {
            destination,
            amount,
            message,
            invoice,
            createdAt: Date.now(),
            status: 'pending'
        });
        
        // Set up invoice monitoring
        monitorInvoicePayment(invoice, paymentHash);
        
        console.log(`✅ Invoice created: ${invoice.substring(0, 50)}...`);
        
        res.json({
            invoice,
            payment_hash: paymentHash,
            expires_at: Date.now() + (10 * 60 * 1000) // 10 minutes
        });
        
    } catch (error) {
        console.error('❌ Error creating invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create invoice via NWC
async function createNWCInvoice(amountSats, description) {
    if (!nwcConfig) {
        throw new Error('NWC not configured');
    }
    
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(nwcConfig.relay);
        
        ws.on('open', async () => {
            // Create make_invoice request
            const request = {
                method: 'make_invoice',
                params: {
                    amount: amountSats * 1000, // Convert to millisats
                    description
                }
            };
            
            // Encrypt and send request
            const encrypted = await encryptNWCMessage(JSON.stringify(request), nwcConfig.secret, nwcConfig.walletPubkey);
            
            const event = {
                kind: 23194,
                content: encrypted,
                tags: [['p', nwcConfig.walletPubkey]],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: getPublicKey(nwcConfig.secret)
            };
            
            const signedEvent = await signEvent(event, nwcConfig.secret);
            ws.send(JSON.stringify(['EVENT', signedEvent]));
        });
        
        ws.on('message', async (data) => {
            const message = JSON.parse(data);
            if (message[0] === 'EVENT') {
                const event = message[2];
                if (event.kind === 23195) {
                    const decrypted = await decryptNWCMessage(event.content, nwcConfig.secret, event.pubkey);
                    const response = JSON.parse(decrypted);
                    
                    if (response.result_type === 'make_invoice') {
                        if (response.result && response.result.invoice) {
                            resolve(response.result.invoice);
                        } else {
                            reject(new Error(response.error?.message || 'Failed to create invoice'));
                        }
                        ws.close();
                    }
                }
            }
        });
        
        ws.on('error', (error) => {
            reject(error);
        });
        
        setTimeout(() => {
            ws.close();
            reject(new Error('Invoice creation timeout'));
        }, 10000);
    });
}

// Monitor invoice payment and forward as keysend
async function monitorInvoicePayment(invoice, paymentHash) {
    const invoiceData = pendingInvoices.get(paymentHash);
    if (!invoiceData) return;
    
    console.log(`👀 Monitoring invoice payment for ${paymentHash.substring(0, 16)}...`);
    
    // Poll for payment status
    const checkInterval = setInterval(async () => {
        try {
            const isPaid = await checkInvoiceStatus(invoice);
            
            if (isPaid) {
                clearInterval(checkInterval);
                console.log(`💰 Invoice paid! Forwarding keysend...`);
                
                // Forward as keysend
                const success = await forwardAsKeysend(
                    invoiceData.destination,
                    invoiceData.amount,
                    invoiceData.message
                );
                
                // Update status
                invoiceData.status = success ? 'completed' : 'failed';
                pendingInvoices.set(paymentHash, invoiceData);
                
                console.log(success ? '✅ Keysend forwarded successfully' : '❌ Keysend forward failed');
            }
        } catch (error) {
            console.error('❌ Error checking invoice:', error);
        }
    }, 2000); // Check every 2 seconds
    
    // Clean up after 10 minutes
    setTimeout(() => {
        clearInterval(checkInterval);
        pendingInvoices.delete(paymentHash);
    }, 10 * 60 * 1000);
}

// Check if invoice is paid via NWC
async function checkInvoiceStatus(invoice) {
    // Implement NWC lookup_invoice
    // Returns true if paid, false otherwise
    // This is simplified - full implementation would use NWC lookup_invoice
    return false;
}

// Forward payment as keysend via NWC
async function forwardAsKeysend(destination, amountSats, message) {
    if (!nwcConfig) {
        throw new Error('NWC not configured');
    }
    
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(nwcConfig.relay);
        
        ws.on('open', async () => {
            // Create pay_keysend request
            const request = {
                method: 'pay_keysend',
                params: {
                    pubkey: destination,
                    amount: amountSats * 1000, // Convert to millisats
                    message: message || ''
                }
            };
            
            // Encrypt and send request
            const encrypted = await encryptNWCMessage(JSON.stringify(request), nwcConfig.secret, nwcConfig.walletPubkey);
            
            const event = {
                kind: 23194,
                content: encrypted,
                tags: [['p', nwcConfig.walletPubkey]],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: getPublicKey(nwcConfig.secret)
            };
            
            const signedEvent = await signEvent(event, nwcConfig.secret);
            ws.send(JSON.stringify(['EVENT', signedEvent]));
        });
        
        ws.on('message', async (data) => {
            const message = JSON.parse(data);
            if (message[0] === 'EVENT') {
                const event = message[2];
                if (event.kind === 23195) {
                    const decrypted = await decryptNWCMessage(event.content, nwcConfig.secret, event.pubkey);
                    const response = JSON.parse(decrypted);
                    
                    if (response.result_type === 'pay_keysend') {
                        if (response.result && !response.error) {
                            resolve(true);
                        } else {
                            console.error('Keysend failed:', response.error);
                            resolve(false);
                        }
                        ws.close();
                    }
                }
            }
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            resolve(false);
        });
        
        setTimeout(() => {
            ws.close();
            resolve(false);
        }, 15000);
    });
}

// Status endpoint
app.get('/api/status/:paymentHash', (req, res) => {
    const { paymentHash } = req.params;
    const invoice = pendingInvoices.get(paymentHash);
    
    if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json({
        status: invoice.status,
        created_at: invoice.createdAt,
        amount: invoice.amount,
        destination: invoice.destination.substring(0, 16) + '...'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        nwc_configured: !!nwcConfig,
        pending_invoices: pendingInvoices.size
    });
});

// Crypto helper functions (simplified - use proper libraries in production)
function getPublicKey(privateKey) {
    // This would use secp256k1 to derive public key
    // Placeholder for demonstration
    return crypto.randomBytes(32).toString('hex');
}

async function encryptNWCMessage(message, ourPrivateKey, theirPublicKey) {
    // Implement NIP-04 encryption
    // Placeholder for demonstration
    return Buffer.from(message).toString('base64');
}

async function decryptNWCMessage(encrypted, ourPrivateKey, theirPublicKey) {
    // Implement NIP-04 decryption
    // Placeholder for demonstration
    return Buffer.from(encrypted, 'base64').toString();
}

async function signEvent(event, privateKey) {
    // Implement Nostr event signing
    // Placeholder for demonstration
    event.id = crypto.randomBytes(32).toString('hex');
    event.sig = crypto.randomBytes(64).toString('hex');
    return event;
}

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`🚀 The Split Box proxy server running on port ${PORT}`);
    console.log(`📡 NWC Status: ${nwcConfig ? 'Connected to ' + nwcConfig.relay : 'Not configured'}`);
    console.log(`\n💡 To configure NWC, set the NWC_CONNECTION_STRING environment variable`);
});