// Dual Payment Methods Demo - Smart Payment Routing
// This demonstrates how to handle both keysend and Lightning address payments
// for universal wallet compatibility without TSB proxy

let nwcClient = null;
let walletCapabilities = {
    keysend: false,
    invoice: false,
    lnaddress: false
};
let currentEpisode = null;
let paymentStats = {
    keysend: 0,
    lnaddress: 0,
    skipped: 0,
    totalSats: 0
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFeed();
    checkExistingConnection();
});

// Check if we have an existing NWC connection
async function checkExistingConnection() {
    const storedConnection = localStorage.getItem('nwc_connection');
    if (storedConnection) {
        try {
            await connectWithString(storedConnection);
        } catch (error) {
            console.error('Failed to restore connection:', error);
            localStorage.removeItem('nwc_connection');
        }
    }
}

// Connect to NWC wallet
async function connectWallet() {
    try {
        // Check if we have a connection string in the URL or prompt for one
        const urlParams = new URLSearchParams(window.location.search);
        let connectionString = urlParams.get('nwc') || prompt('Enter your NWC connection string:');
        
        if (!connectionString) {
            logMessage('Connection cancelled', 'warning');
            return;
        }
        
        await connectWithString(connectionString);
        
    } catch (error) {
        console.error('Connection error:', error);
        logMessage(`Connection failed: ${error.message}`, 'error');
        updateConnectionStatus(false);
    }
}

// Connect using NWC connection string
async function connectWithString(connectionString) {
    // Basic validation and parsing
    if (!connectionString.startsWith('nostr+walletconnect://')) {
        throw new Error('Invalid NWC connection string format');
    }
    
    try {
        // Parse the connection string
        const nwcUrl = new URL(connectionString);
        const pubkey = nwcUrl.hostname || nwcUrl.pathname.replace('//', '');
        const relay = nwcUrl.searchParams.get('relay');
        const secret = nwcUrl.searchParams.get('secret');
        
        if (!pubkey || !relay || !secret) {
            throw new Error('Missing required NWC parameters');
        }
        
        // Initialize with a basic client structure
        nwcClient = {
            pubkey: pubkey,
            relay: relay,
            secret: secret,
            connected: false
        };
        
        // Simulate connection for demo purposes
        await new Promise(resolve => setTimeout(resolve, 1000));
        nwcClient.connected = true;
        
        // Simulate getting wallet info
        await detectWalletCapabilities();
        
        // Store connection for persistence
        localStorage.setItem('nwc_connection', connectionString);
        
        updateConnectionStatus(true);
        logMessage('Wallet connected successfully', 'success');
        
    } catch (error) {
        throw new Error(`Failed to connect: ${error.message}`);
    }
}

// Detect wallet capabilities
async function detectWalletCapabilities() {
    if (!nwcClient) return;
    
    try {
        // Simulate wallet info response
        const walletName = 'Demo Wallet';
        document.getElementById('wallet-name').textContent = walletName;
        
        // For demo purposes, simulate different wallet capabilities
        // In a real app, this would query the actual wallet
        const demoCapabilities = {
            keysend: true,
            invoice: true,
            lnaddress: true
        };
        
        walletCapabilities = demoCapabilities;
        
        // Update UI
        updateCapabilityDisplay();
        
    } catch (error) {
        console.error('Failed to detect capabilities:', error);
        // Default to invoice-only if detection fails
        walletCapabilities = {
            keysend: false,
            invoice: true,
            lnaddress: true
        };
        updateCapabilityDisplay();
    }
}

// Update capability display in UI
function updateCapabilityDisplay() {
    document.getElementById('cap-keysend').className = 
        walletCapabilities.keysend ? 'supported' : 'unsupported';
    document.getElementById('cap-invoice').className = 
        walletCapabilities.invoice ? 'supported' : 'unsupported';
    document.getElementById('cap-lnaddress').className = 
        walletCapabilities.lnaddress ? 'supported' : 'unsupported';
}

// Update connection status UI
function updateConnectionStatus(connected) {
    const statusBadge = document.getElementById('connection-status');
    const walletInfo = document.getElementById('wallet-info');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const sendBtn = document.getElementById('send-payment-btn');
    
    if (connected) {
        statusBadge.textContent = 'Connected';
        statusBadge.className = 'status-badge status-connected';
        walletInfo.style.display = 'block';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'block';
        if (currentEpisode) {
            sendBtn.disabled = false;
        }
    } else {
        statusBadge.textContent = 'Disconnected';
        statusBadge.className = 'status-badge status-disconnected';
        walletInfo.style.display = 'none';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        sendBtn.disabled = true;
    }
}

// Disconnect wallet
function disconnectWallet() {
    nwcClient = null;
    localStorage.removeItem('nwc_connection');
    updateConnectionStatus(false);
    logMessage('Wallet disconnected', 'info');
}

// Load RSS feed
async function loadFeed() {
    try {
        const response = await fetch('/test-feed.xml');
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        
        // Get all episodes
        const items = xml.querySelectorAll('item');
        const episodeSelect = document.getElementById('episode-select');
        
        items.forEach((item, index) => {
            const title = item.querySelector('title').textContent;
            const option = document.createElement('option');
            option.value = index;
            option.textContent = title;
            episodeSelect.appendChild(option);
        });
        
        // Store the feed for later use
        window.rssFeed = xml;
        
    } catch (error) {
        console.error('Failed to load feed:', error);
        logMessage('Failed to load RSS feed', 'error');
    }
}

// Load selected episode
function loadEpisode() {
    const episodeIndex = document.getElementById('episode-select').value;
    if (!episodeIndex && episodeIndex !== '0') {
        document.getElementById('episode-info').style.display = 'none';
        document.getElementById('recipients-container').style.display = 'none';
        currentEpisode = null;
        return;
    }
    
    const items = window.rssFeed.querySelectorAll('item');
    const item = items[parseInt(episodeIndex)];
    
    // Get episode info
    const title = item.querySelector('title').textContent;
    const description = item.querySelector('description').textContent;
    
    // Update UI
    document.getElementById('episode-title').textContent = title;
    document.getElementById('episode-title').style.color = 'var(--text-primary)';
    document.getElementById('episode-description').textContent = description;
    document.getElementById('episode-description').style.color = 'var(--text-secondary)';
    document.getElementById('episode-info').style.display = 'block';
    
    // Get value block (episode-level or channel-level)
    let valueBlock = item.querySelector('value');
    if (!valueBlock) {
        // Use channel-level value block
        valueBlock = window.rssFeed.querySelector('channel > value');
    }
    
    // Parse recipients
    const recipients = parseRecipients(valueBlock);
    currentEpisode = {
        title: title,
        recipients: recipients
    };
    
    // Display recipients with smart routing preview
    displayRecipients(recipients);
    
    // Enable send button if connected
    if (nwcClient && nwcClient.connected) {
        document.getElementById('send-payment-btn').disabled = false;
    }
    
    logMessage(`Loaded episode: ${title}`, 'info');
}

// Parse recipients from value block
function parseRecipients(valueBlock) {
    const recipients = [];
    const recipientElements = valueBlock.querySelectorAll('valueRecipient');
    
    // Group recipients by name to identify dual payment options
    const recipientMap = {};
    
    recipientElements.forEach(element => {
        const name = element.getAttribute('name');
        const type = element.getAttribute('type');
        const address = element.getAttribute('address');
        const split = parseInt(element.getAttribute('split'));
        
        if (!recipientMap[name]) {
            recipientMap[name] = {
                name: name,
                split: split,
                methods: {}
            };
        }
        
        if (type === 'node') {
            recipientMap[name].methods.keysend = address;
        } else if (type === 'lnaddress') {
            recipientMap[name].methods.lnaddress = address;
        }
    });
    
    // Convert to array
    for (const name in recipientMap) {
        recipients.push(recipientMap[name]);
    }
    
    return recipients;
}

// Display recipients with routing information
function displayRecipients(recipients) {
    const container = document.getElementById('recipients-container');
    const listElement = document.getElementById('recipients-list');
    
    container.style.display = 'block';
    listElement.innerHTML = '';
    
    recipients.forEach(recipient => {
        const card = document.createElement('div');
        card.className = 'recipient-card';
        
        // Determine which payment method will be used
        const routingDecision = determinePaymentMethod(recipient);
        
        if (!routingDecision.canPay) {
            card.classList.add('skipped');
        }
        
        card.innerHTML = `
            <div class="recipient-header">
                <span class="recipient-name">${recipient.name}</span>
                <span class="recipient-split">${recipient.split}%</span>
            </div>
            <div class="payment-methods">
                ${recipient.methods.keysend ? `
                    <div class="payment-method ${routingDecision.method === 'keysend' ? 'active' : ''}">
                        ⚡ Keysend
                    </div>
                ` : ''}
                ${recipient.methods.lnaddress ? `
                    <div class="payment-method ${routingDecision.method === 'lnaddress' ? 'fallback' : ''}">
                        @ Lightning Address
                    </div>
                ` : ''}
            </div>
            ${routingDecision.reason ? `
                <div style="margin-top: 10px; font-size: 0.85em; color: ${routingDecision.canPay ? 'var(--accent-success)' : 'var(--accent-danger)'};">
                    ${routingDecision.reason}
                </div>
            ` : ''}
        `;
        
        listElement.appendChild(card);
    });
}

// Determine which payment method to use for a recipient
function determinePaymentMethod(recipient) {
    // Priority: keysend > Lightning address
    
    if (recipient.methods.keysend && walletCapabilities.keysend) {
        return {
            canPay: true,
            method: 'keysend',
            address: recipient.methods.keysend,
            reason: '✅ Using keysend (preferred method)'
        };
    }
    
    if (recipient.methods.lnaddress && walletCapabilities.lnaddress) {
        return {
            canPay: true,
            method: 'lnaddress',
            address: recipient.methods.lnaddress,
            reason: '⚠️ Using Lightning address (fallback)'
        };
    }
    
    // No compatible payment method
    return {
        canPay: false,
        method: null,
        address: null,
        reason: '❌ No compatible payment method available'
    };
}

// Send payments to all recipients (demo version)
async function sendPayments() {
    if (!nwcClient || !nwcClient.connected || !currentEpisode) {
        logMessage('Not ready to send payments', 'error');
        return;
    }
    
    const totalAmount = 1000; // Total sats to send
    const recipients = currentEpisode.recipients;
    
    logMessage(`Starting payment distribution of ${totalAmount} sats`, 'info');
    
    // Reset stats for this payment
    const sessionStats = {
        keysend: 0,
        lnaddress: 0,
        skipped: 0,
        totalSats: 0
    };
    
    // Process each recipient
    for (const recipient of recipients) {
        const routingDecision = determinePaymentMethod(recipient);
        const amount = Math.floor((totalAmount * recipient.split) / 100);
        
        if (!routingDecision.canPay) {
            logMessage(`⏭️ Skipping ${recipient.name} - ${routingDecision.reason}`, 'warning');
            sessionStats.skipped++;
            continue;
        }
        
        try {
            logMessage(`💸 Sending ${amount} sats to ${recipient.name} via ${routingDecision.method}`, 'info');
            
            // Simulate payment delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (routingDecision.method === 'keysend') {
                sessionStats.keysend++;
                logMessage(`✅ Keysend payment successful to ${recipient.name}`, 'success');
            } else if (routingDecision.method === 'lnaddress') {
                sessionStats.lnaddress++;
                logMessage(`✅ Lightning address payment successful to ${recipient.name}`, 'success');
            }
            
            sessionStats.totalSats += amount;
            
        } catch (error) {
            logMessage(`❌ Payment failed to ${recipient.name}: ${error.message}`, 'error');
        }
    }
    
    // Update global stats
    paymentStats.keysend += sessionStats.keysend;
    paymentStats.lnaddress += sessionStats.lnaddress;
    paymentStats.skipped += sessionStats.skipped;
    paymentStats.totalSats += sessionStats.totalSats;
    
    // Update stats display
    updateStatsDisplay();
    
    logMessage(`Payment complete! Sent ${sessionStats.totalSats} sats total`, 'success');
}

// Update stats display
function updateStatsDisplay() {
    document.getElementById('payment-stats').style.display = 'grid';
    document.getElementById('stat-keysend').textContent = paymentStats.keysend;
    document.getElementById('stat-lnaddress').textContent = paymentStats.lnaddress;
    document.getElementById('stat-skipped').textContent = paymentStats.skipped;
    document.getElementById('stat-total').textContent = paymentStats.totalSats;
}

// Log message to the payment log
function logMessage(message, type = 'info') {
    const logCard = document.getElementById('payment-log');
    const logEntries = document.getElementById('log-entries');
    
    logCard.style.display = 'block';
    
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    
    logEntries.appendChild(entry);
    
    // Auto-scroll to bottom
    const logContainer = logCard.querySelector('.payment-log');
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Keep only last 50 entries
    while (logEntries.children.length > 50) {
        logEntries.removeChild(logEntries.firstChild);
    }
}
// Supports both keysend pubkeys and Lightning addresses per recipient

const DualPaymentHandler = {
    
    /**
     * Enhanced RSS parsing with comprehensive fallbacks (from main branch) plus dual payment method grouping
     */
    parseValueBlocksWithFallback: function(xmlDoc, episodeLimit = 10) {
        const recipients = new Map(); // Group by recipient name
        const valueBlocks = [];
        
        console.log('🔍 Starting comprehensive dual payment parsing...');
        
        // Helper functions from main branch
        const extractLightningAddresses = (text) => {
            const lightningRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
            return [...new Set(text.match(lightningRegex) || [])];
        };
        
        const extractNodePubkeys = (text) => {
            const pubkeyRegex = /([0-9a-fA-F]{66})/g;
            return [...new Set(text.match(pubkeyRegex) || [])];
        };
        
        const addRecipient = (name, type, address, split, group, groupTitle, episodeNumber = null) => {
            if (!address) return;
            
            // Group by name and split within the same value block (this creates dual recipients!)
            const recipientKey = `${group}-${name}-${split || 'default'}`;
            
            if (!recipients.has(recipientKey)) {
                recipients.set(recipientKey, {
                    name: name,
                    split: split,
                    keysend: null,
                    lnaddress: null,
                    group: group,
                    groupTitle: groupTitle,
                    episodeNumber: episodeNumber
                });
            }
            
            const recipientData = recipients.get(recipientKey);
            
            // Assign payment methods based on type (original working logic)
            if (type === 'node' && address.match(/^[0-9a-fA-F]{66}$/)) {
                recipientData.keysend = address;
            } else if (type === 'lnaddress' && address.includes('@')) {
                recipientData.lnaddress = address;
            }
        };
        
        // 1. Parse structured podcast:value blocks (comprehensive approach from main branch)
        console.log('🔍 Step 1: Parsing structured podcast:value blocks...');
        
        // Try all selectors for podcast:value elements
        let valueBlocksElements = xmlDoc.querySelectorAll('podcast\\:value');
        if (valueBlocksElements.length === 0) valueBlocksElements = xmlDoc.querySelectorAll('value');
        if (valueBlocksElements.length === 0) {
            // Manual search for local-name value elements
            const allElements = xmlDoc.getElementsByTagName('*');
            const valueElements = [];
            for (let el of allElements) {
                if (el.localName === 'value') valueElements.push(el);
            }
            valueBlocksElements = valueElements;
        }
        
        console.log(`🔍 Found ${valueBlocksElements.length} structured value blocks`);
        
        valueBlocksElements.forEach((valueBlock, index) => {
            // Try all selectors for valueRecipient elements
            let recipients_els = valueBlock.querySelectorAll('podcast\\:valueRecipient');
            if (recipients_els.length === 0) recipients_els = valueBlock.querySelectorAll('valueRecipient');
            if (recipients_els.length === 0) {
                // Manual search for local-name valueRecipient elements
                const allElements = valueBlock.getElementsByTagName('*');
                const recipientElements = [];
                for (let el of allElements) {
                    if (el.localName === 'valueRecipient') recipientElements.push(el);
                }
                recipients_els = recipientElements;
            }
            
            // Determine if this is channel-level or episode-level
            let parentItem = valueBlock.closest('item');
            if (!parentItem) {
                // Try walking up the DOM tree manually
                let current = valueBlock.parentElement;
                while (current && current.tagName !== 'ITEM') {
                    current = current.parentElement;
                }
                parentItem = current;
            }
            
            let group, groupTitle, episodeNumber;
            if (parentItem) {
                const titleEl = parentItem.querySelector('title') || (function() {
                    const titleEls = parentItem.getElementsByTagName('*');
                    for (let el of titleEls) {
                        if (el.localName === 'title') return el;
                    }
                    return null;
                })();
                const title = titleEl ? titleEl.textContent.trim() : `Episode ${index + 1}`;
                group = `episode-${index}`;
                groupTitle = title;
                episodeNumber = index + 1;
            } else {
                group = 'channel';
                groupTitle = 'Channel Level';
                episodeNumber = null;
            }
            
            recipients_els.forEach(recipient => {
                const type = recipient.getAttribute('type');
                const address = recipient.getAttribute('address');
                const name = recipient.getAttribute('name') || `Recipient ${recipients_els.length}`;
                const split = recipient.getAttribute('split');
                
                addRecipient(name, type, address, split, group, groupTitle, episodeNumber);
            });
        });
        
        // 2. Fallback: Parse episode text for addresses (from main branch approach)
        console.log('🔍 Step 2: Fallback parsing of episode text...');
        
        const items = Array.from(xmlDoc.querySelectorAll('channel > item'));
        const itemsToProcess = episodeLimit > 0 ? items.slice(0, episodeLimit) : items;
        
        console.log(`🔍 Processing ${itemsToProcess.length} episodes for text extraction`);
        
        itemsToProcess.forEach((item, index) => {
            const titleEl = item.querySelector('title') || (function() {
                const titleEls = item.getElementsByTagName('*');
                for (let el of titleEls) {
                    if (el.localName === 'title') return el;
                }
                return null;
            })();
            const title = titleEl ? titleEl.textContent.trim() : `Episode ${index + 1}`;
            const description = item.querySelector('description')?.textContent || '';
            const content = item.querySelector('content\\:encoded')?.textContent || 
                           (function() {
                               const encodedEls = item.getElementsByTagName('*');
                               for (let el of encodedEls) {
                                   if (el.localName === 'encoded') return el.textContent;
                               }
                               return '';
                           })() || '';
            
            const fullText = `${title} ${description} ${content}`;
            const textLightningAddresses = extractLightningAddresses(fullText);
            const textNodePubkeys = extractNodePubkeys(fullText);
            
            // Add found addresses as recipients
            textLightningAddresses.forEach((addr, addrIndex) => {
                addRecipient(
                    `Lightning Address ${addrIndex + 1}`, 
                    'lnaddress', 
                    addr, 
                    '', 
                    `episode-${index}`, 
                    title, 
                    index + 1
                );
            });
            
            textNodePubkeys.forEach((pubkey, pubkeyIndex) => {
                addRecipient(
                    `Node Pubkey ${pubkeyIndex + 1}`, 
                    'node', 
                    pubkey, 
                    '', 
                    `episode-${index}`, 
                    title, 
                    index + 1
                );
            });
        });
        
        // 3. Final fallback: Scan entire XML text (from main branch)
        if (recipients.size === 0) {
            console.log('🔍 Step 3: Final fallback - scanning entire XML...');
            
            const xmlText = xmlDoc.documentElement.outerHTML;
            const lightningAddresses = extractLightningAddresses(xmlText);
            const nodePubkeys = extractNodePubkeys(xmlText);
            
            lightningAddresses.forEach((addr, index) => {
                addRecipient(
                    `Lightning Address ${index + 1}`, 
                    'lnaddress', 
                    addr, 
                    '', 
                    'xml-fallback', 
                    'Found in XML', 
                    null
                );
            });
            
            nodePubkeys.forEach((pubkey, index) => {
                addRecipient(
                    `Node Pubkey ${index + 1}`, 
                    'node', 
                    pubkey, 
                    '', 
                    'xml-fallback', 
                    'Found in XML', 
                    null
                );
            });
        }
        
        // Convert Map to array format with dual payment structure
        recipients.forEach((recipientData, key) => {
            valueBlocks.push({
                title: recipientData.name,
                keysend: recipientData.keysend,
                lnaddress: recipientData.lnaddress,
                split: recipientData.split,
                group: recipientData.group,
                groupTitle: recipientData.groupTitle,
                episodeNumber: recipientData.episodeNumber,
                guid: `dual-${key}`,
                type: 'dual', // New type for dual payment recipients
                description: `${recipientData.name} - Keysend: ${recipientData.keysend ? 'Yes' : 'No'}, LN Address: ${recipientData.lnaddress ? 'Yes' : 'No'}`
            });
        });
        
        console.log(`✅ Comprehensive parsing complete: ${valueBlocks.length} recipients found`);
        console.log(`🔍 Recipients by group:`, [...recipients.keys()].reduce((acc, key) => {
            const group = recipients.get(key).group;
            acc[group] = (acc[group] || 0) + 1;
            return acc;
        }, {}));
        
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
     * Smart payment routing based on wallet capabilities (original working logic)
     */
    routePayment: function(recipient, walletCapabilities) {
        const { keysend, invoice, walletType } = walletCapabilities;
        
        // Priority routing logic: keysend first (if wallet supports and recipient has it)
        if (keysend && recipient.keysend) {
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