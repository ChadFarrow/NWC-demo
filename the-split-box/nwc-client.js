// NWC Client Implementation for The Split Box
const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const WebSocket = require('ws');

class NWCClient {
    constructor(connectionString) {
        this.parseConnectionString(connectionString);
        this.responseHandlers = new Map();
    }
    
    parseConnectionString(connectionString) {
        if (!connectionString.startsWith('nostr+walletconnect://')) {
            throw new Error('Invalid NWC connection string');
        }
        
        const url = new URL(connectionString.replace('nostr+walletconnect://', 'https://'));
        this.walletPubkey = url.hostname;
        
        const params = new URLSearchParams(url.search);
        this.relay = params.get('relay').replace(/%2F/g, '/').replace(/%3A/g, ':');
        this.secret = params.get('secret');
        
        // Derive our public key from secret
        const secretBytes = Buffer.from(this.secret, 'hex');
        const publicKeyBytes = secp256k1.publicKeyCreate(secretBytes, true);
        this.pubkey = Buffer.from(publicKeyBytes).toString('hex').substring(2);
    }
    
    async makeInvoice(amountSats, description) {
        const request = {
            method: 'make_invoice',
            params: {
                amount: amountSats * 1000, // Convert to millisats
                description
            }
        };
        
        const response = await this.sendRequest(request);
        if (response.error) {
            throw new Error(response.error.message || 'Failed to create invoice');
        }
        
        return response.result.invoice;
    }
    
    async lookupInvoice(invoice) {
        const request = {
            method: 'lookup_invoice',
            params: {
                invoice,
                bolt11: invoice
            }
        };
        
        const response = await this.sendRequest(request);
        if (response.error) {
            return null;
        }
        
        return response.result;
    }
    
    async payKeysend(pubkey, amountSats, message = '') {
        const request = {
            method: 'pay_keysend',
            params: {
                pubkey,
                amount: amountSats * 1000, // Convert to millisats
                message
            }
        };
        
        const response = await this.sendRequest(request);
        if (response.error) {
            throw new Error(response.error.message || 'Keysend failed');
        }
        
        return response.result;
    }
    
    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this.relay);
            const requestId = crypto.randomBytes(16).toString('hex');
            
            ws.on('open', async () => {
                try {
                    // Encrypt the request
                    const encrypted = await this.encrypt(
                        JSON.stringify(request),
                        this.secret,
                        this.walletPubkey
                    );
                    
                    // Create Nostr event
                    const event = {
                        kind: 23194,
                        content: encrypted,
                        tags: [['p', this.walletPubkey]],
                        created_at: Math.floor(Date.now() / 1000),
                        pubkey: this.pubkey
                    };
                    
                    // Sign the event
                    const signedEvent = await this.signEvent(event);
                    
                    // Store response handler
                    this.responseHandlers.set(signedEvent.id, resolve);
                    
                    // Send the event
                    ws.send(JSON.stringify(['EVENT', signedEvent]));
                    
                    // Also subscribe to responses
                    const subscription = [
                        'REQ',
                        requestId,
                        {
                            kinds: [23195],
                            authors: [this.walletPubkey],
                            '#p': [this.pubkey],
                            since: Math.floor(Date.now() / 1000) - 10
                        }
                    ];
                    ws.send(JSON.stringify(subscription));
                    
                } catch (error) {
                    reject(error);
                    ws.close();
                }
            });
            
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    if (message[0] === 'EVENT') {
                        const event = message[2];
                        
                        if (event.kind === 23195) {
                            // Decrypt the response
                            const decrypted = await this.decrypt(
                                event.content,
                                this.secret,
                                this.walletPubkey
                            );
                            
                            const response = JSON.parse(decrypted);
                            resolve(response);
                            ws.close();
                        }
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            });
            
            ws.on('error', (error) => {
                reject(error);
            });
            
            // Timeout after 15 seconds
            setTimeout(() => {
                reject(new Error('Request timeout'));
                ws.close();
            }, 15000);
        });
    }
    
    async encrypt(text, ourPrivateKey, theirPublicKey) {
        // Get shared secret
        const sharedSecret = secp256k1.ecdh(
            Buffer.from('02' + theirPublicKey, 'hex'),
            Buffer.from(ourPrivateKey, 'hex')
        );
        
        // Use shared secret as encryption key
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            sharedSecret.slice(0, 32),
            iv
        );
        
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        return encrypted + '?iv=' + iv.toString('base64');
    }
    
    async decrypt(encryptedData, ourPrivateKey, theirPublicKey) {
        const [encrypted, ivBase64] = encryptedData.split('?iv=');
        const iv = Buffer.from(ivBase64, 'base64');
        
        // Get shared secret
        const sharedSecret = secp256k1.ecdh(
            Buffer.from('02' + theirPublicKey, 'hex'),
            Buffer.from(ourPrivateKey, 'hex')
        );
        
        // Decrypt
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            sharedSecret.slice(0, 32),
            iv
        );
        
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
    
    async signEvent(event) {
        // Create event hash
        const eventData = JSON.stringify([
            0,
            event.pubkey,
            event.created_at,
            event.kind,
            event.tags,
            event.content
        ]);
        
        const hash = crypto.createHash('sha256').update(eventData).digest();
        event.id = hash.toString('hex');
        
        // Sign the hash
        const signature = secp256k1.ecdsaSign(
            hash,
            Buffer.from(this.secret, 'hex')
        );
        
        event.sig = Buffer.from(signature.signature).toString('hex');
        
        return event;
    }
}

module.exports = NWCClient;