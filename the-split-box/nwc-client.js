// NWC Client Implementation for The Split Box using Alby SDK
require('websocket-polyfill');

class NWCClient {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.client = null;
    }
    
    async ensureConnected() {
        if (!this.client) {
            const { NWCClient } = await import('@getalby/sdk');
            this.client = new NWCClient({ nostrWalletConnectUrl: this.connectionString });
        }
    }
    
    async makeInvoice(amountSats, description) {
        await this.ensureConnected();
        const result = await this.client.makeInvoice({
            amount: amountSats * 1000, // Convert to millisats
            description
        });
        return result.invoice;
    }
    
    async lookupInvoice(invoice) {
        await this.ensureConnected();
        try {
            const result = await this.client.lookupInvoice({
                invoice
            });
            console.log('📋 Invoice lookup result:', result);
            return result;
        } catch (error) {
            console.log('❌ Invoice lookup error:', error.message);
            return null;
        }
    }
    
    async payKeysend(pubkey, amountSats, message = '') {
        await this.ensureConnected();
        console.log(`🔄 Attempting keysend: ${amountSats} sats to ${pubkey.substring(0, 16)}...`);
        try {
            const result = await this.client.payKeysend({
                destination: pubkey,  // Try 'destination' instead of 'pubkey'
                amount: amountSats * 1000, // Convert to millisats
                message
            });
            console.log('✅ Keysend successful:', result);
            return result;
        } catch (error) {
            console.error('❌ Keysend failed, trying with pubkey parameter...');
            // Fallback to 'pubkey' parameter if 'destination' doesn't work
            const result = await this.client.payKeysend({
                pubkey,
                amount: amountSats * 1000,
                message
            });
            console.log('✅ Keysend successful with pubkey param:', result);
            return result;
        }
    }
}

module.exports = NWCClient;