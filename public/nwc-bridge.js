// NWC Bridge - Uses backend API to handle NWC operations with Alby SDK
// This replaces the complex nwcjs response handling with simple API calls

const nwcBridge = {
    // Store NWC connection string
    connectionString: null,
    
    // Initialize with NWC connection string
    init: function(nwcString) {
        this.connectionString = nwcString;
        console.log('✅ NWC Bridge initialized');
    },
    
    // Pay invoice using backend NWC
    payInvoice: async function(invoice) {
        try {
            const response = await fetch('/api/nwc/pay-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nwc_string: this.connectionString,
                    invoice: invoice
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Payment failed');
            }
            
            return result;
        } catch (error) {
            console.error('❌ Pay invoice error:', error);
            throw error;
        }
    },
    
    // Send keysend using backend NWC or proxy
    sendKeysend: async function(destination, amount, message) {
        try {
            // First try direct keysend through backend
            const keysendResponse = await fetch('/api/nwc/keysend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nwc_string: this.connectionString,
                    destination: destination,
                    amount: amount,
                    message: message
                })
            });
            
            const keysendResult = await keysendResponse.json();
            
            if (keysendResult.success) {
                return keysendResult;
            }
            
            // If keysend not supported, use proxy
            console.log('🔄 Keysend not supported, using proxy...');
            
            const proxyResponse = await fetch('/api/proxy/keysend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination: destination,
                    amount: amount,
                    message: message,
                    walletSupportsKeysend: false
                })
            });
            
            const proxyData = await proxyResponse.json();
            if (!proxyData.success) {
                throw new Error(proxyData.error || 'Proxy failed');
            }
            
            // Pay the proxy invoice
            console.log('💳 Paying proxy invoice...');
            const payResult = await this.payInvoice(proxyData.invoice);
            
            return {
                success: true,
                method: 'proxy',
                payment_hash: payResult.payment_hash,
                preimage: payResult.preimage,
                tracking_id: proxyData.tracking_id
            };
            
        } catch (error) {
            console.error('❌ Keysend error:', error);
            throw error;
        }
    },
    
    // Get wallet info
    getInfo: async function() {
        try {
            const response = await fetch('/api/nwc/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nwc_string: this.connectionString
                })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to get info');
            }
            
            return result;
        } catch (error) {
            console.error('❌ Get info error:', error);
            throw error;
        }
    }
};

// Make it globally available
window.nwcBridge = nwcBridge;