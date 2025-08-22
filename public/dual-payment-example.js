// Enhanced RSS parsing and payment routing for dual payment methods
// Supports both keysend pubkeys and Lightning addresses per recipient

const DualPaymentHandler = {
    
    /**
     * Enhanced RSS parsing that groups recipients by name and combines payment methods
     */
    parseValueBlocksWithFallback: function(xmlDoc) {
        const recipients = new Map(); // Group by recipient name
        const valueBlocks = [];
        
        // Parse channel-level value blocks
        const channelValues = xmlDoc.querySelectorAll('channel > podcast\\:value, channel > value');
        
        channelValues.forEach((channelValue, channelIndex) => {
            const valueRecipients = channelValue.querySelectorAll(':scope > podcast\\:valueRecipient, :scope > valueRecipient');
            
            valueRecipients.forEach((recipient, recIndex) => {
                const name = recipient.getAttribute('name') || `Recipient ${recIndex + 1}`;
                const type = recipient.getAttribute('type') || 'unknown';
                const address = recipient.getAttribute('address') || '';
                const lnaddress = recipient.getAttribute('lnaddress') || ''; // Custom attribute
                const split = recipient.getAttribute('split') || '';
                
                if (!address) return;
                
                // Create or update recipient entry
                const recipientKey = `${name}-${split}`;
                
                if (!recipients.has(recipientKey)) {
                    recipients.set(recipientKey, {
                        name: name,
                        split: split,
                        keysend: null,
                        lnaddress: null,
                        group: 'channel',
                        groupTitle: 'Channel Level'
                    });
                }
                
                const recipientData = recipients.get(recipientKey);
                
                // Assign payment methods based on type
                if (type === 'node' && address.match(/^[0-9a-fA-F]{66}$/)) {
                    recipientData.keysend = address;
                } else if (type === 'lnaddress' && address.includes('@')) {
                    recipientData.lnaddress = address;
                }
                
                // Check for custom lnaddress attribute
                if (lnaddress && lnaddress.includes('@')) {
                    recipientData.lnaddress = lnaddress;
                }
            });
        });
        
        // Convert Map to array format for compatibility
        recipients.forEach((recipientData, key) => {
            valueBlocks.push({
                title: recipientData.name,
                keysend: recipientData.keysend,
                lnaddress: recipientData.lnaddress,
                split: recipientData.split,
                group: recipientData.group,
                groupTitle: recipientData.groupTitle,
                guid: `dual-${key}`,
                type: 'dual', // New type for dual payment recipients
                description: `${recipientData.name} - Keysend: ${recipientData.keysend ? 'Yes' : 'No'}, LN Address: ${recipientData.lnaddress ? 'Yes' : 'No'}`
            });
        });
        
        return valueBlocks;
    },
    
    /**
     * Detect wallet capabilities for payment routing
     */
    detectWalletCapabilities: async function(nwcInfo) {
        try {
            const walletInfo = await nwcjs.getInfo(nwcInfo, 10);
            
            if (!walletInfo || walletInfo.error) {
                throw new Error('Failed to get wallet info');
            }
            
            const supportedMethods = walletInfo.result?.methods || [];
            const capabilities = {
                keysend: supportedMethods.includes('pay_keysend'),
                invoice: supportedMethods.includes('pay_invoice'),
                walletType: this.identifyWalletType(nwcInfo, walletInfo),
                alias: walletInfo.result?.alias || 'Unknown Wallet'
            };
            
            console.log('🔍 Wallet capabilities detected:', capabilities);
            return capabilities;
            
        } catch (error) {
            console.error('❌ Wallet capability detection failed:', error);
            return {
                keysend: false,
                invoice: true, // Most wallets support invoice payments
                walletType: 'unknown',
                alias: 'Unknown Wallet'
            };
        }
    },
    
    /**
     * Identify wallet type based on connection details
     */
    identifyWalletType: function(nwcInfo, walletInfo) {
        const relay = nwcInfo.relay?.toLowerCase() || '';
        const alias = walletInfo.result?.alias?.toLowerCase() || '';
        
        if (relay.includes('relay.primal.net') || alias.includes('primal')) {
            return 'primal';
        } else if (relay.includes('relay.coinos.io') || alias.includes('coinos')) {
            return 'coinos';
        } else if (relay.includes('relay.getalby.com') || alias.includes('alby')) {
            return 'alby';
        } else if (alias.includes('mutiny')) {
            return 'mutiny';
        }
        
        return 'unknown';
    },
    
    /**
     * Smart payment routing based on wallet capabilities
     */
    routePayment: function(recipient, walletCapabilities) {
        const { keysend, invoice, walletType } = walletCapabilities;
        
        // Priority routing logic
        if (keysend && recipient.keysend) {
            // Wallet supports keysend and recipient has keysend address
            return {
                method: 'keysend',
                address: recipient.keysend,
                reasoning: 'Wallet supports keysend, using preferred method'
            };
        } else if (invoice && recipient.lnaddress) {
            // Fall back to Lightning address
            return {
                method: 'lnaddress',
                address: recipient.lnaddress,
                reasoning: keysend ? 'No keysend address available' : 'Wallet does not support keysend'
            };
        } else if (recipient.keysend && !keysend) {
            // Wallet doesn't support keysend, but no Lightning address available
            return {
                method: 'unsupported',
                address: null,
                reasoning: `${walletType} wallet cannot pay keysend addresses. Contact ${recipient.name} for a Lightning address.`
            };
        } else {
            // No valid payment method available
            return {
                method: 'unavailable',
                address: null,
                reasoning: 'No compatible payment methods available for this recipient'
            };
        }
    },
    
    /**
     * Execute payment based on routing decision
     */
    executePayment: async function(nwcInfo, recipient, amount, message, routingDecision) {
        const { method, address, reasoning } = routingDecision;
        
        console.log(`💳 Payment routing for ${recipient.name}:`, {
            method,
            address: address?.substring(0, 20) + '...',
            reasoning
        });
        
        switch (method) {
            case 'keysend':
                return await this.sendKeysendPayment(nwcInfo, address, amount, message, recipient);
                
            case 'lnaddress':
                return await this.sendLightningAddressPayment(nwcInfo, address, amount, message, recipient);
                
            case 'unsupported':
            case 'unavailable':
                throw new Error(reasoning);
                
            default:
                throw new Error(`Unknown payment method: ${method}`);
        }
    },
    
    /**
     * Send keysend payment
     */
    sendKeysendPayment: async function(nwcInfo, destination, amount, message, recipient) {
        try {
            console.log(`🔑 Sending keysend to ${recipient.name}: ${amount} sats`);
            
            const result = await nwcjs.payKeysend_OLD(
                nwcInfo, 
                destination, 
                amount, 
                `${message} (${recipient.split}% to ${recipient.name})`,
                15
            );
            
            if (result && !result.error) {
                return {
                    success: true,
                    method: 'keysend',
                    recipient: recipient.name,
                    amount: amount,
                    hash: result.result?.payment_hash,
                    result: result
                };
            } else {
                throw new Error(result?.error?.message || 'Keysend payment failed');
            }
            
        } catch (error) {
            console.error(`❌ Keysend payment failed for ${recipient.name}:`, error);
            throw error;
        }
    },
    
    /**
     * Send Lightning address payment
     */
    sendLightningAddressPayment: async function(nwcInfo, lnaddress, amount, message, recipient) {
        try {
            console.log(`📧 Sending to Lightning address ${recipient.name}: ${amount} sats`);
            
            // Get invoice from Lightning address
            const [invoice, checkingId] = await nwcjs.getZapRequest(lnaddress, amount);
            
            if (!invoice) {
                throw new Error('Failed to get invoice from Lightning address');
            }
            
            // Pay the invoice
            const result = await nwcjs.payInvoice(nwcInfo, invoice, 30);
            
            if (result && !result.error) {
                // Check for zap receipt
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const zapReceipt = await nwcjs.checkZapStatus(invoice, checkingId);
                    
                    return {
                        success: true,
                        method: 'lnaddress',
                        recipient: recipient.name,
                        amount: amount,
                        hash: result.result?.payment_hash,
                        zapReceipt: zapReceipt,
                        result: result
                    };
                } catch (receiptError) {
                    console.log(`⚠️ Zap receipt check failed, but payment succeeded`);
                    return {
                        success: true,
                        method: 'lnaddress',
                        recipient: recipient.name,
                        amount: amount,
                        hash: result.result?.payment_hash,
                        result: result
                    };
                }
            } else {
                throw new Error(result?.error?.message || 'Lightning address payment failed');
            }
            
        } catch (error) {
            console.error(`❌ Lightning address payment failed for ${recipient.name}:`, error);
            throw error;
        }
    },
    
    /**
     * Process all payments with smart routing
     */
    processAllPayments: async function(nwcInfo, recipients, totalAmount, message) {
        // Detect wallet capabilities first
        const walletCapabilities = await this.detectWalletCapabilities(nwcInfo);
        
        console.log(`💼 Processing payments with ${walletCapabilities.alias} (${walletCapabilities.walletType})`);
        console.log(`🔍 Capabilities: Keysend=${walletCapabilities.keysend}, Invoice=${walletCapabilities.invoice}`);
        
        const results = [];
        let totalSent = 0;
        
        // Calculate total split percentage
        const totalSplit = recipients.reduce((sum, recipient) => {
            return sum + (parseFloat(recipient.split) || 0);
        }, 0);
        
        for (const recipient of recipients) {
            try {
                const splitAmount = Math.floor((totalAmount * parseFloat(recipient.split)) / totalSplit);
                
                if (splitAmount <= 0) {
                    console.log(`⚠️ Skipping ${recipient.name}: zero amount`);
                    continue;
                }
                
                // Route payment based on wallet capabilities
                const routingDecision = this.routePayment(recipient, walletCapabilities);
                
                if (routingDecision.method === 'unsupported' || routingDecision.method === 'unavailable') {
                    results.push({
                        success: false,
                        recipient: recipient.name,
                        amount: splitAmount,
                        error: routingDecision.reasoning,
                        method: routingDecision.method
                    });
                    continue;
                }
                
                // Execute payment
                const paymentResult = await this.executePayment(
                    nwcInfo, 
                    recipient, 
                    splitAmount, 
                    message, 
                    routingDecision
                );
                
                results.push(paymentResult);
                totalSent += splitAmount;
                
                console.log(`✅ Payment ${results.length} successful: ${recipient.name} - ${splitAmount} sats via ${routingDecision.method}`);
                
                // Small delay between payments
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Payment failed for ${recipient.name}:`, error);
                results.push({
                    success: false,
                    recipient: recipient.name,
                    amount: Math.floor((totalAmount * parseFloat(recipient.split)) / totalSplit),
                    error: error.message,
                    method: 'failed'
                });
            }
        }
        
        return {
            walletCapabilities,
            totalAmount,
            totalSent,
            results,
            summary: {
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                keysendPayments: results.filter(r => r.method === 'keysend' && r.success).length,
                lnaddressPayments: results.filter(r => r.method === 'lnaddress' && r.success).length,
                unsupportedRecipients: results.filter(r => r.method === 'unsupported').length
            }
        };
    }
};

// Export for use in the main application
window.DualPaymentHandler = DualPaymentHandler;

console.log('✅ Dual Payment Handler loaded successfully');