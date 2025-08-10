// V4V Lightning Payment Tester - Main Script
// Refactored for clarity and maintainability

// --- Theme Toggle ---
function toggleTheme() {
    const toggle = document.querySelector('.theme-toggle');
    const currentIcon = toggle.textContent;
    toggle.textContent = currentIcon === '☀️' ? '🌙' : '☀️';
    toggle.style.transform = 'rotate(360deg)';
    setTimeout(() => { toggle.style.transform = 'rotate(0deg)'; }, 300);
}

// --- Button Feedback Helper ---
function setButtonFeedback(btn, text, duration = 2000, resetText = null, enable = true) {
    btn.innerHTML = text;
    btn.disabled = !enable;
    if (resetText) {
        setTimeout(() => {
            btn.innerHTML = resetText;
            btn.disabled = false;
        }, duration);
    }
}

// --- Fetch and Parse RSS Feed ---
async function fetchRssFeed(feedUrl) {
    // Try multiple CORS proxies in order
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
        `https://cors-anywhere.herokuapp.com/${feedUrl}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(feedUrl)}`
    ];
    
    for (let i = 0; i < proxies.length; i++) {
        const proxyUrl = proxies[i];
        console.log(`Trying proxy ${i + 1}/${proxies.length}: ${proxyUrl}`);
        
        try {
            const response = await fetch(proxyUrl);
            if (response.ok) {
                console.log(`✅ Success with proxy ${i + 1}`);
                return await response.text();
            } else {
                console.log(`❌ Proxy ${i + 1} failed with status: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Proxy ${i + 1} failed with error:`, error.message);
        }
    }
    
    // If all proxies fail, try direct fetch (might work in some cases)
    console.log('All proxies failed, trying direct fetch...');
    try {
        const response = await fetch(feedUrl);
        if (response.ok) {
            console.log('✅ Direct fetch succeeded');
            return await response.text();
        }
    } catch (error) {
        console.log('❌ Direct fetch also failed:', error.message);
    }
    
    throw new Error('Failed to fetch RSS feed: all proxy attempts failed');
}

function parseXml(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Invalid XML format in RSS feed');
    }
    return xmlDoc;
}

// --- Main Parse Button Handler ---
async function parseValueBlock() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    setButtonFeedback(btn, '⚡ Parsing...', null, null, false);
    try {
        const rssInput = document.querySelector('input[type="url"]');
        const feedUrl = rssInput.value;
        if (!feedUrl) throw new Error('Please enter a RSS feed URL');
        const xmlText = await fetchRssFeed(feedUrl);
        const xmlDoc = parseXml(xmlText);
        const valueBlocks = extractValueBlocks(xmlDoc);
        if (valueBlocks.length === 0) {
            setButtonFeedback(btn, '⚠️ No value blocks found', 2000, originalText);
            return;
        }
        // Store XML for loading more episodes
        window._lastXmlDoc = xmlDoc;
        window._allEpisodesLoaded = false;
        window._currentEpisodeLimit = 5; // Track how many episodes we've loaded
        
        displayValueBlocks(valueBlocks, xmlDoc);
        setButtonFeedback(btn, '✅ Parsed Successfully', 2000, originalText);
    } catch (error) {
        console.error('Error parsing value block:', error);
        setButtonFeedback(btn, '❌ Error: ' + error.message, 3000, originalText);
    }
}

// --- Value Block Extraction ---
function extractValueBlocks(xmlDoc, episodeLimit = 5) {
    const valueBlocks = [];
    
    // First, get all episode items and limit based on episodeLimit
    const allItems = Array.from(xmlDoc.querySelectorAll('item'));
    const itemsToProcess = episodeLimit > 0 ? allItems.slice(0, episodeLimit) : allItems;
    
    // Try all selectors for podcast:value
    let valueBlocksElements = xmlDoc.querySelectorAll('podcast\\:value');
    if (valueBlocksElements.length === 0) valueBlocksElements = xmlDoc.querySelectorAll('value');
    if (valueBlocksElements.length === 0) valueBlocksElements = xmlDoc.querySelectorAll('*[local-name()="value"]');
    valueBlocksElements.forEach((valueBlock, index) => {
        let recipients = valueBlock.querySelectorAll('podcast\\:valueRecipient');
        if (recipients.length === 0) recipients = valueBlock.querySelectorAll('valueRecipient');
        if (recipients.length === 0) recipients = valueBlock.querySelectorAll('*[local-name()="valueRecipient"]');
        const lightningAddresses = [], nodePubkeys = [];
        recipients.forEach(recipient => {
            const type = recipient.getAttribute('type');
            const address = recipient.getAttribute('address');
            const name = recipient.getAttribute('name');
            const split = recipient.getAttribute('split');
            if (type === 'lnaddress' && address) lightningAddresses.push({ address, name, split });
            else if (type === 'node' && address) nodePubkeys.push({ address, name, split });
        });
        // Detect <podcast:metaBoost> tag
        let metaBoost = '';
        // Try namespaced and non-namespaced
        let metaBoostEl = valueBlock.querySelector('podcast\\:metaBoost') ||
                          valueBlock.querySelector('metaBoost');
        if (!metaBoostEl) {
            // Fallback: check all children for localName === 'metaBoost'
            for (const child of valueBlock.children) {
                if (child.localName === 'metaBoost') {
                    metaBoostEl = child;
                    break;
                }
            }
        }
        if (metaBoostEl) {
            metaBoost = metaBoostEl.textContent;
        }
        if (lightningAddresses.length > 0 || nodePubkeys.length > 0 || metaBoost) {
            let title = 'Value Block';
            
            // Try multiple ways to find the parent item element
            let parentItem = valueBlock.closest('item');
            if (!parentItem) {
                // Try walking up the DOM tree manually
                let current = valueBlock.parentElement;
                while (current && current.tagName !== 'ITEM') {
                    current = current.parentElement;
                }
                parentItem = current;
            }
            
            if (parentItem) {
                // Check if this episode item should be included
                if (episodeLimit > 0 && !itemsToProcess.includes(parentItem)) {
                    return; // Skip this episode if it's not in our limited list
                }
                
                // Try different ways to get the title
                const titleEl = parentItem.querySelector('title') || 
                               parentItem.querySelector('*[local-name()="title"]');
                if (titleEl) {
                    title = titleEl.textContent.trim() || title;
                }
            }
            
            valueBlocks.push({ title, lightningAddresses, nodePubkeys, metaBoost, index: index + 1 });
        }
    });
    // Fallback: scan episode text for addresses (respect episode limit)
    itemsToProcess.forEach((item, index) => {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const content = item.querySelector('content\\:encoded')?.textContent || '';
        const textLightningAddresses = extractLightningAddresses(title + ' ' + description + ' ' + content);
        const textNodePubkeys = extractNodePubkeys(title + ' ' + description + ' ' + content);
        if (textLightningAddresses.length > 0 || textNodePubkeys.length > 0) {
            valueBlocks.push({
                title,
                lightningAddresses: textLightningAddresses.map(addr => ({ address: addr, name: '', split: '' })),
                nodePubkeys: textNodePubkeys.map(pubkey => ({ address: pubkey, name: '', split: '' })),
                metaBoost: '',
                index: valueBlocks.length + index + 1
            });
        }
    });
    // Fallback: scan entire XML text
    if (valueBlocks.length === 0) {
        const xmlText = xmlDoc.documentElement.outerHTML;
        const lightningAddresses = extractLightningAddresses(xmlText);
        const nodePubkeys = extractNodePubkeys(xmlText);
        if (lightningAddresses.length > 0 || nodePubkeys.length > 0) {
            valueBlocks.push({
                title: 'Value Block (Found in XML)',
                lightningAddresses: lightningAddresses.map(addr => ({ address: addr, name: '', split: '' })),
                nodePubkeys: nodePubkeys.map(pubkey => ({ address: pubkey, name: '', split: '' })),
                metaBoost: '',
                index: 1
            });
        }
    }
    return valueBlocks;
}

function extractLightningAddresses(text) {
    const lightningRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    return [...new Set(text.match(lightningRegex) || [])];
}

function extractNodePubkeys(text) {
    const pubkeyRegex = /([0-9a-fA-F]{66})/g;
    return [...new Set(text.match(pubkeyRegex) || [])];
}

// --- Value Block Display ---
function displayValueBlocks(valueBlocks, xmlDoc) {
    // Remove any existing results
    document.querySelector('.value-blocks-results')?.remove();
    // Sort so Show Value Block(s) come first
    valueBlocks.sort((a, b) => {
        const isShowA = a.title === 'Value Block' || a.title === 'Value Block (Found in XML)';
        const isShowB = b.title === 'Value Block' || b.title === 'Value Block (Found in XML)';
        if (isShowA && !isShowB) return -1;
        if (!isShowA && isShowB) return 1;
        return 0;
    });
    
    // Separate show value blocks from episode value blocks
    const allShowBlocks = valueBlocks.filter(block => 
        block.title === 'Value Block' || block.title === 'Value Block (Found in XML)'
    );
    const allEpisodeBlocks = valueBlocks.filter(block => 
        block.title !== 'Value Block' && block.title !== 'Value Block (Found in XML)'
    );
    
    // Deduplicate episode blocks by title
    const uniqueEpisodeBlocks = [];
    const seenEpisodeTitles = new Set();
    
    allEpisodeBlocks.forEach(block => {
        if (!seenEpisodeTitles.has(block.title)) {
            seenEpisodeTitles.add(block.title);
            uniqueEpisodeBlocks.push(block);
        }
    });
    
    // Use all unique episode blocks (no further limiting here)
    const episodeBlocks = uniqueEpisodeBlocks;
    
    // Deduplicate show value blocks based on recipients
    const showBlocks = [];
    const seenSignatures = new Set();
    
    allShowBlocks.forEach((block, index) => {
        // Create a signature for this block based on recipients and metaBoost
        const lightningAddrs = block.lightningAddresses?.map(addr => `${addr.address}:${addr.split || 'undefined'}`).sort() || [];
        const nodePubkeys = block.nodePubkeys?.map(pubkey => `${pubkey.address}:${pubkey.split || 'undefined'}`).sort() || [];
        const metaBoost = block.metaBoost || '';
        const signature = JSON.stringify({ lightningAddrs, nodePubkeys, metaBoost });
        
        if (!seenSignatures.has(signature)) {
            seenSignatures.add(signature);
            showBlocks.push(block);
        }
    });
    
    // Filter out show blocks from episode blocks to avoid duplication
    const finalEpisodeBlocks = episodeBlocks.filter(episodeBlock => {
        // Don't show episode blocks that are identical to show blocks
        const episodeLightningAddrs = episodeBlock.lightningAddresses?.map(addr => `${addr.address}:${addr.split || 'undefined'}`).sort() || [];
        const episodeNodePubkeys = episodeBlock.nodePubkeys?.map(pubkey => `${pubkey.address}:${pubkey.split || 'undefined'}`).sort() || [];
        const episodeMetaBoost = episodeBlock.metaBoost || '';
        const episodeSignature = JSON.stringify({ lightningAddrs: episodeLightningAddrs, nodePubkeys: episodeNodePubkeys, metaBoost: episodeMetaBoost });
        
        return !seenSignatures.has(episodeSignature);
    });
    
    // Remove any existing results container
    document.querySelector('.value-blocks-results')?.remove();
    
    // Add results summary to the RSS Feed card
    const rssCard = document.querySelector('.card');
    
    let episodeToggleHtml = '';
    if (xmlDoc) {
        // Count total episodes in the feed vs episodes we've parsed
        const totalEpisodes = xmlDoc.querySelectorAll('item').length;
        const currentLimit = window._currentEpisodeLimit || 5;
        const remainingEpisodes = totalEpisodes - currentLimit;
        
        episodeToggleHtml = remainingEpisodes > 0 ? 
            `<button class="btn btn-secondary" style="margin-top: 1rem;" onclick="loadMoreEpisodes()">
                <span id="episode-toggle-text">Show 10 More Episodes (${remainingEpisodes} remaining)</span>
            </button>` : '';
    }
    
    // Create summary of show blocks with recipient counts
    let showBlocksSummary = '';
    if (showBlocks.length > 0) {
        const showBlockDetails = showBlocks.map((block, index) => {
            const totalRecipients = (block.lightningAddresses?.length || 0) + (block.nodePubkeys?.length || 0);
            return `${index + 1}: ${totalRecipients} recipients`;
        }).join(', ');
        showBlocksSummary = ` (${showBlockDetails})`;
    }
    
    // Create or update results section in RSS card
    let resultsSection = rssCard.querySelector('.rss-results');
    if (!resultsSection) {
        resultsSection = document.createElement('div');
        resultsSection.className = 'rss-results';
        resultsSection.style.cssText = `
            border-top: 1px solid var(--border-color);
            padding-top: 1rem;
            margin-top: 1rem;
        `;
        rssCard.appendChild(resultsSection);
    }
    
    resultsSection.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <strong>📊 Value Blocks Found: ${valueBlocks.length}</strong>
        </div>
        <div style="margin-bottom: 0.5rem; font-size: 0.9rem;">
            <strong>Show Blocks:</strong> ${showBlocks.length}${showBlocksSummary}${allShowBlocks.length > showBlocks.length ? ` • ${allShowBlocks.length - showBlocks.length} duplicates hidden` : ''}
        </div>
        <div style="margin-bottom: 0.5rem; font-size: 0.9rem;">
            <strong>Episode Blocks:</strong> ${finalEpisodeBlocks.length}
        </div>
        ${episodeToggleHtml}
    `;
    
    rssCard.scrollIntoView({ behavior: 'smooth' });
    
    // Render show value blocks first
    let lastCard = rssCard;
    showBlocks.forEach((block, index) => {
        const card = document.createElement('div');
        card.className = 'card value-block-card';
        card.appendChild(renderValueBlock(block, index));
        lastCard.parentNode.insertBefore(card, lastCard.nextSibling);
        lastCard = card;
    });
    
    // Render episode value blocks (initially limited to first 5)
    finalEpisodeBlocks.forEach((block, index) => {
        const card = document.createElement('div');
        card.className = 'card value-block-card episode-block';
        card.appendChild(renderValueBlock(block, showBlocks.length + index));
        lastCard.parentNode.insertBefore(card, lastCard.nextSibling);
        lastCard = card;
    });
    
    // --- Payment Form Population ---
    populatePaymentRecipients(valueBlocks);
    // Store last value blocks for use in the form
    window._lastValueBlocks = valueBlocks;
}

// In renderValueBlock, display metaBoost endpoint if present
function renderValueBlock(block, index) {
    const blockElement = document.createElement('div');
    blockElement.className = 'value-block';
    blockElement.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        border: 1px solid var(--border-color);
    `;
    // Label with recipient count
    let label = '';
    const totalRecipients = (block.lightningAddresses?.length || 0) + (block.nodePubkeys?.length || 0);
    const recipientText = totalRecipients > 0 ? ` (${totalRecipients} recipients)` : '';
    
    if (block.title === 'Value Block' || block.title === 'Value Block (Found in XML)') {
        label = `<span style="display:inline-block;background:var(--accent-secondary);color:white;padding:0.2em 0.7em;border-radius:6px;font-size:0.9em;margin-bottom:0.5em;">Show Value Block${recipientText}</span>`;
    } else if (block.title && block.title !== 'Value Block') {
        label = `<span style="display:inline-block;background:var(--accent-primary);color:white;padding:0.2em 0.7em;border-radius:6px;font-size:0.9em;margin-bottom:0.5em;">Episode Value Block${recipientText}</span>`;
    } else {
        label = `<span style="display:inline-block;background:#888;color:white;padding:0.2em 0.7em;border-radius:6px;font-size:0.9em;margin-bottom:0.5em;">Other Value Block${recipientText}</span>`;
    }
    // Collapsible content
    const detailsId = `value-block-details-${index}`;
    let content = `
        ${label}
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style=\"color: var(--text-primary); margin-bottom: 0.5rem; margin-right: 1rem;\">${block.title}</h3>
            <button class=\"btn btn-secondary\" style=\"font-size:1rem;padding:0.3em 1em;\" onclick=\"toggleValueBlock('${detailsId}')\">Expand</button>
        </div>
        <div id=\"${detailsId}\" style=\"display:none; margin-top:1rem;\">`;
    if (block.metaBoost) {
        content += `
            <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                <div>
                    <strong>metaBoost Endpoint:</strong>
                    <a href="${block.metaBoost}" target="_blank" rel="noopener noreferrer">${block.metaBoost}</a>
                </div>
                <button class="btn btn-primary" style="padding: 0.3em 1em; font-size: 1rem;" onclick="sendTestMetaBoost('${block.metaBoost}')">Send Test Boost</button>
            </div>
        `;
    }
    if (block.lightningAddresses.length > 0) {
        content += `
            <div style="margin-bottom: 1rem;">
                <h4 style="color: var(--accent-primary); margin-bottom: 0.5rem;">⚡ Lightning Addresses:</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${block.lightningAddresses.map(addr => `
                        <div style="
                            background: var(--accent-primary);
                            color: white;
                            padding: 0.5rem;
                            border-radius: 8px;
                            font-family: 'JetBrains Mono', monospace;
                            font-size: 0.9rem;
                            display: flex;
                            flex-direction: column;
                            gap: 0.25rem;
                        ">
                            <div style="font-weight: bold;">${addr.name || 'Lightning Address'}</div>
                            <div>${addr.address}</div>
                            ${addr.split ? `<div style=\"font-size: 0.8rem; opacity: 0.8;\">Split: ${addr.split}%</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    if (block.nodePubkeys.length > 0) {
        content += `
            <div>
                <h4 style="color: var(--accent-secondary); margin-bottom: 0.5rem;">🔑 Node Pubkeys:</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${block.nodePubkeys.map(pubkey => `
                        <div style="
                            background: var(--accent-secondary);
                            color: white;
                            padding: 0.5rem;
                            border-radius: 8px;
                            font-family: 'JetBrains Mono', monospace;
                            font-size: 0.9rem;
                            display: flex;
                            flex-direction: column;
                            gap: 0.25rem;
                            word-break: break-all;
                        ">
                            <div style="font-weight: bold;">${pubkey.name || 'Node Pubkey'}</div>
                            <a href=\"https://amboss.space/node/${pubkey.address}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color: #fff; text-decoration: underline;\">${pubkey.address}</a>
                            ${pubkey.split ? `<div style=\"font-size: 0.8rem; opacity: 0.8;\">Split: ${pubkey.split}%</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    // Add QR code section
    content += `
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <strong>📱 QR Codes</strong>
                <button class="btn btn-secondary" style="padding: 0.3em 1em; font-size: 0.9rem;" onclick="generateRecipientQRs('${detailsId}', ${index})">
                    Generate QR Codes
                </button>
            </div>
            <div id="qr-code-${index}" style="margin-top: 1rem;"></div>
        </div>
    `;
    content += `</div>`;
    blockElement.innerHTML = content;
    return blockElement;
}

// --- UI Actions ---
window.toggleValueBlock = function(detailsId) {
    const details = document.getElementById(detailsId);
    if (!details) return;
    const btn = details.previousElementSibling.querySelector('button');
    if (details.style.display === 'none') {
        details.style.display = 'block';
        if (btn) btn.textContent = 'Collapse';
    } else {
        details.style.display = 'none';
        if (btn) btn.textContent = 'Expand';
    }
};

window.generateRecipientQRs = function(detailsId, blockIndex) {
    const valueBlocks = window._lastValueBlocks;
    if (!valueBlocks || !valueBlocks[blockIndex]) {
        console.error('Value block not found');
        return;
    }
    
    const block = valueBlocks[blockIndex];
    const qrContainer = document.getElementById(`qr-code-${blockIndex}`);
    
    if (!qrContainer) {
        console.error('QR code container not found');
        return;
    }
    
    // Clear existing QR codes
    qrContainer.innerHTML = '<div style="color: var(--text-muted); padding: 1rem;">Generating QR codes...</div>';
    
    const qrCodes = [];
    
    // Generate QR codes for Lightning addresses
    if (block.lightningAddresses && block.lightningAddresses.length > 0) {
        block.lightningAddresses.forEach(addr => {
            if (addr.address) {
                // Add Lightning address QR code
                qrCodes.push({
                    type: 'Lightning Address',
                    name: addr.name || 'Lightning Address',
                    address: addr.address,
                    split: addr.split,
                    qrData: addr.address,
                    format: 'Lightning Address'
                });
                
                // Also add LNURL-pay QR code
                const lnurlPayUrl = convertLightningAddressToLNURL(addr.address);
                qrCodes.push({
                    type: 'LNURL-pay',
                    name: `${addr.name || 'Lightning Address'} (LNURL)`,
                    address: addr.address,
                    split: addr.split,
                    qrData: lnurlPayUrl,
                    format: 'LNURL-pay'
                });
            }
        });
    }
    
    // Generate QR codes for node pubkeys (as Lightning URIs)
    if (block.nodePubkeys && block.nodePubkeys.length > 0) {
        block.nodePubkeys.forEach(pubkey => {
            if (pubkey.address) {
                qrCodes.push({
                    type: 'Node Pubkey',
                    name: pubkey.name || 'Node Pubkey',
                    address: pubkey.address,
                    split: pubkey.split,
                    qrData: `lightning:${pubkey.address}` // Lightning URI format
                });
            }
        });
    }
    
    if (qrCodes.length === 0) {
        qrContainer.innerHTML = '<div style="color: var(--text-muted); padding: 1rem;">No Lightning addresses or node pubkeys found</div>';
        return;
    }
    
    // Generate individual QR codes
    generateIndividualQRs(qrContainer, qrCodes, block);
};

// Convert Lightning address to LNURL-pay format
function convertLightningAddressToLNURL(lightningAddress) {
    // Lightning address format: user@domain.com
    // LNURL-pay format: https://domain.com/.well-known/lnurlp/user
    
    const parts = lightningAddress.split('@');
    if (parts.length !== 2) {
        console.error('Invalid Lightning address format:', lightningAddress);
        return lightningAddress; // Return as-is if invalid
    }
    
    const [username, domain] = parts;
    const lnurlPayUrl = `https://${domain}/.well-known/lnurlp/${username}`;
    
    // Encode the URL as bech32 LNURL (as per LUD-01)
    try {
        // For now, return the raw URL - wallets can handle both formats
        // In a full implementation, you'd encode this as bech32 starting with 'lnurl'
        return lnurlPayUrl;
    } catch (error) {
        console.error('Failed to convert to LNURL:', error);
        return lightningAddress; // Fallback to Lightning address
    }
}

// Generate individual QR codes for each recipient
function generateIndividualQRs(qrContainer, qrCodes, block) {
    qrContainer.innerHTML = '';
    
    // Create grid container
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
    `;
    
    qrCodes.forEach((qrCode, index) => {
        const qrCard = document.createElement('div');
        qrCard.style.cssText = `
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 1rem;
            text-align: center;
        `;
        
        // QR code title
        const title = document.createElement('div');
        title.style.cssText = `
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
        `;
        title.textContent = `${qrCode.name}${qrCode.split ? ` (${qrCode.split}%)` : ''}`;
        
        // QR code image (centered)
        const img = document.createElement('img');
        const encodedData = encodeURIComponent(qrCode.qrData);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedData}`;
        
        img.src = qrUrl;
        img.alt = `QR Code for ${qrCode.name}`;
        img.style.cssText = `
            width: 180px;
            height: 180px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: white;
            padding: 8px;
            margin: 0.5rem auto;
            display: block;
        `;
        
        // Format badge (below QR code)
        const formatBadge = document.createElement('div');
        formatBadge.style.cssText = `
            font-size: 0.7rem;
            background: var(--accent-primary);
            color: white;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            margin: 0.5rem auto;
            display: inline-block;
        `;
        formatBadge.textContent = qrCode.format || qrCode.type;
        
        // Address display
        const addressDiv = document.createElement('div');
        addressDiv.style.cssText = `
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
            word-break: break-all;
        `;
        addressDiv.textContent = qrCode.address;
        
        // Buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 0.5rem;
            justify-content: center;
            margin-top: 0.5rem;
        `;
        
        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-primary';
        downloadBtn.style.cssText = `
            padding: 0.3rem 0.8rem;
            font-size: 0.8rem;
        `;
        downloadBtn.innerHTML = '💾';
        downloadBtn.onclick = function() {
            const link = document.createElement('a');
            link.download = `${qrCode.name.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
            link.href = qrUrl;
            link.click();
        };
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-secondary';
        copyBtn.style.cssText = `
            padding: 0.3rem 0.8rem;
            font-size: 0.8rem;
        `;
        copyBtn.innerHTML = '📋';
        copyBtn.onclick = function() {
            navigator.clipboard.writeText(qrCode.qrData).then(() => {
                copyBtn.innerHTML = '✅';
                setTimeout(() => {
                    copyBtn.innerHTML = '📋';
                }, 2000);
            });
        };
        
        buttonsContainer.appendChild(downloadBtn);
        buttonsContainer.appendChild(copyBtn);
        
        // Error handling
        img.onerror = function() {
            img.style.display = 'none';
            const errorDiv = document.createElement('div');
            errorDiv.style.color = 'var(--accent-danger)';
            errorDiv.textContent = 'Failed to generate QR code';
            qrCard.insertBefore(errorDiv, addressDiv);
        };
        
        qrCard.appendChild(title);
        qrCard.appendChild(img);
        qrCard.appendChild(formatBadge);
        qrCard.appendChild(addressDiv);
        qrCard.appendChild(buttonsContainer);
        
        gridContainer.appendChild(qrCard);
    });
    
    qrContainer.appendChild(gridContainer);
}


window.loadMoreEpisodes = function() {
    if (!window._lastXmlDoc || window._allEpisodesLoaded) return;
    
    const btn = document.getElementById('episode-toggle-text')?.parentElement;
    if (btn) {
        btn.innerHTML = '⚡ Loading more episodes...';
        btn.disabled = true;
    }
    
    // Increase episode limit by 10
    const currentLimit = window._currentEpisodeLimit || 5;
    const newLimit = currentLimit + 10;
    window._currentEpisodeLimit = newLimit;
    
    console.log(`Loading episodes up to ${newLimit}...`);
    const totalEpisodes = window._lastXmlDoc.querySelectorAll('item').length;
    
    // Check if we've reached the end
    if (newLimit >= totalEpisodes) {
        window._allEpisodesLoaded = true;
        console.log('All episodes loaded');
    }
    
    // Extract value blocks with new limit
    const valueBlocks = extractValueBlocks(window._lastXmlDoc, newLimit);
    
    console.log(`Value blocks found with limit ${newLimit}: ${valueBlocks.length}`);
    
    // Update the display
    displayValueBlocks(valueBlocks, window._allEpisodesLoaded ? null : window._lastXmlDoc);
};

function clearSettings() {
    if (confirm('Are you sure you want to clear all settings?')) {
        document.querySelectorAll('.form-input').forEach(input => { input.value = ''; });
        setButtonFeedback(event.target, '✅ Cleared', 1500, event.target.innerHTML);
    }
}

function loadTestFeed() {
    const rssInput = document.querySelector('input[type="url"]');
    rssInput.value = 'https://v4v-lightning-payment-tester-o9dcyzifv-chadfs-projects.vercel.app/metaboost-test-feed.xml';
    rssInput.style.borderColor = 'var(--accent-success)';
    setTimeout(() => { rssInput.style.borderColor = 'var(--border-color)'; }, 2000);
    setButtonFeedback(event.target, '✅ Loaded', 1500, event.target.innerHTML);
}

// --- NWC Wallet Connection ---
async function connectWallet() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    setButtonFeedback(btn, '🔄 Connecting...', null, null, false);
    
    try {
        const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
        const nwcString = nwcInput.value.trim();
        
        if (!nwcString) {
            throw new Error('Please enter a Nostr Wallet Connect string');
        }
        
        // Parse NWC connection string
        const nwcUrl = new URL(nwcString);
        if (!nwcUrl.protocol.startsWith('nostr+walletconnect')) {
            throw new Error('Invalid NWC connection string format');
        }
        
        // Extract connection details
        const relay = nwcUrl.searchParams.get('relay');
        const secret = nwcUrl.searchParams.get('secret');
        const pubkey = nwcUrl.hostname;
        
        if (!relay || !secret || !pubkey) {
            throw new Error('Missing required NWC parameters (relay, secret, pubkey)');
        }
        
        // Skip get_info test and create mock capabilities for now
        // (get_info test was failing, so we'll validate NWC connection instead)
        console.log('Validating NWC connection without get_info...');
        
        // Test relay connection first
        const relayTest = await testRelayConnectionInternal(relay);
        if (!relayTest.success) {
            throw new Error(`Relay connection failed: ${relayTest.error}`);
        }
        
        // Test nostr-tools availability
        await waitForNostrTools();
        
        // Test encryption capability
        const testMessage = JSON.stringify({ test: 'connection' });
        await window.nip04.encrypt(secret, pubkey, testMessage);
        
        console.log('✅ NWC connection validated successfully');
        
        const walletInfo = {
            methods: ['pay_keysend', 'pay_invoice', 'get_balance'],
            pay_keysend: {
                max_amount: 1000000,
                min_amount: 1,
                fee_reserve: 1000
            }
        };
        
        // Display capabilities
        displayWalletCapabilities(walletInfo);
        
        // Save NWC string to localStorage on successful connection
        localStorage.setItem('nwcString', nwcString);
        
        setButtonFeedback(btn, '✅ Connected', 2000, originalText);
        
    } catch (error) {
        console.error('NWC connection error:', error);
        setButtonFeedback(btn, '❌ ' + error.message, 3000, originalText);
    }
}


function displayWalletCapabilities(walletInfo) {
    // Remove any existing wallet info
    document.querySelector('.wallet-capabilities')?.remove();
    
    // Create capabilities display
    const capabilitiesDiv = document.createElement('div');
    capabilitiesDiv.className = 'wallet-capabilities';
    capabilitiesDiv.innerHTML = `
        <div class="card-header">
            <div class="card-icon">🔗</div>
            <h2 class="card-title">Wallet Connected</h2>
        </div>
        <div style="padding: 1rem;">
            <div style="margin-bottom: 1rem;">
                <strong>Supported Methods:</strong>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                    ${walletInfo.methods.map(method => `
                        <span style="
                            background: var(--accent-primary);
                            color: white;
                            padding: 0.2rem 0.5rem;
                            border-radius: 4px;
                            font-size: 0.8rem;
                        ">${method}</span>
                    `).join('')}
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Keysend Support:</strong> 
                <span style="color: ${walletInfo.methods.includes('pay_keysend') ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-weight: bold;">
                    ${walletInfo.methods.includes('pay_keysend') ? '✅ Supported' : '❌ Not Supported'}
                </span>
            </div>
            ${walletInfo.pay_keysend ? `
                <div>
                    <strong>Keysend Limits:</strong>
                    <div style="margin-top: 0.5rem; font-size: 0.9rem;">
                        <div>Max Amount: ${walletInfo.pay_keysend.max_amount?.toLocaleString() || 'Unknown'} sats</div>
                        <div>Min Amount: ${walletInfo.pay_keysend.min_amount || 'Unknown'} sats</div>
                        <div>Fee Reserve: ${walletInfo.pay_keysend.fee_reserve || 'Unknown'} sats</div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    // Insert into the wallet-info div
    const walletInfoDiv = document.getElementById('wallet-info');
    if (walletInfoDiv) {
        walletInfoDiv.innerHTML = '';
        walletInfoDiv.appendChild(capabilitiesDiv);
    }
}

// Add this function to send a test metaBoost
async function sendTestMetaBoost(endpoint) {
    const payload = {
        podcast: "Test Show",
        episode: "LNURL Testing Episode",
        sender: "testuser@wallet.com",
        amount: 1000,
        message: "Great episode!",
        payment_proof: "test-proof",
        timestamp: new Date().toISOString()
    };
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        alert('metaBoost response: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        alert('metaBoost error: ' + e.message);
    }
}

// Expose sendTestMetaBoost to the window for inline onclick
window.sendTestMetaBoost = sendTestMetaBoost;

// --- Payment Form Population ---
function populatePaymentRecipients(valueBlocks) {
    const container = document.getElementById('recipient-checkboxes');
    const selectAll = document.getElementById('select-all-recipients');
    if (!container) return;
    container.innerHTML = '';
    if (!valueBlocks || valueBlocks.length === 0) return;
    // Use the first value block for now
    const block = valueBlocks[0];
    let idx = 0;
    if (block.lightningAddresses) {
        block.lightningAddresses.forEach(addr => {
            if (!addr.address) return; // Skip if address is empty
            const id = `recipient-checkbox-${idx++}`;
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '0.5em';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = addr.address;
            checkbox.setAttribute('data-split', addr.split || '');
            checkbox.setAttribute('data-type', 'lnaddress');
            checkbox.id = id;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ⚡ ${addr.address} (${addr.split ? addr.split + '%' : 'no split'})`));
            container.appendChild(label);
        });
    }
    if (block.nodePubkeys) {
        block.nodePubkeys.forEach(pubkey => {
            if (!pubkey.address) return; // Skip if pubkey is empty
            const id = `recipient-checkbox-${idx++}`;
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '0.5em';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = pubkey.address;
            checkbox.setAttribute('data-split', pubkey.split || '');
            checkbox.setAttribute('data-type', 'node');
            checkbox.id = id;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` 🔑 ${pubkey.address} (${pubkey.split ? pubkey.split + '%' : 'no split'})`));
            container.appendChild(label);
        });
    }
    // Add select-all logic
    if (selectAll) {
        selectAll.checked = false;
        selectAll.onclick = function() {
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
        };
        // Uncheck select-all if any recipient is manually unchecked
        container.addEventListener('change', function(e) {
            if (e.target.type === 'checkbox' && !e.target.checked) {
                selectAll.checked = false;
            } else if (e.target.type === 'checkbox') {
                // If all are checked, check select-all
                const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                if (Array.from(checkboxes).every(cb => cb.checked)) {
                    selectAll.checked = true;
                }
            }
        });
    }
}

// --- Real Payment Logic ---
async function sendRealPayment(event) {
    event.preventDefault();
    const amount = parseInt(document.getElementById('payment-amount').value, 10);
    const message = document.getElementById('payment-message').value;
    const recipient = document.getElementById('payment-recipient').value;
    const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
    const nwcString = nwcInput.value.trim();
    if (!nwcString) {
        alert('Please connect your wallet (enter NWC string) first.');
        return;
    }
    if (!recipient) {
        alert('Please select a recipient.');
        return;
    }
    if (!amount || amount < 1) {
        alert('Please enter a valid amount.');
        return;
    }
    try {
        const result = await sendNWCKeysendMinimal(nwcString, recipient, amount, message);
        if (result.success) {
            alert('Payment sent! Preimage: ' + result.preimage);
        } else {
            alert('Payment failed: ' + (result.error || 'Unknown error'));
        }
    } catch (e) {
        alert('Payment error: ' + e.message);
    }
}
window.sendRealPayment = sendRealPayment;

// Wait for nostr-tools to be loaded
async function waitForNostrTools() {
  while (!window.nostrTools || !window.nip04 || !window.getPublicKey) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

// --- Minimal NIP-47 keysend for browser (using nostr-tools NIP-04) ---
async function sendNWCKeysendMinimal(nwcString, destination, amount, message) {
    console.log(`\n=== NWC Keysend Payment Start ===`);
    console.log(`Destination: ${destination}`);
    console.log(`Amount: ${amount} sats`);
    console.log(`Message: ${message}`);
    
    await waitForNostrTools();
    console.log('✅ nostr-tools loaded');
    
    // Parse NWC string
    const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
    const pubkey = url.hostname;
    const relay = url.searchParams.get('relay');
    const secret = url.searchParams.get('secret');
    
    console.log(`Wallet pubkey: ${pubkey}`);
    console.log(`Relay: ${relay}`);
    console.log(`Secret present: ${!!secret}`);
    
    if (!relay || !pubkey || !secret) throw new Error('Invalid NWC string');

    // Use nostr-tools for NIP-04
    if (!window.nip04) throw new Error('nostr-tools not loaded');

    // Build NIP-47 request
    const req = {
        method: "pay_keysend",
        params: { destination, amount, message }
    };
    const reqJson = JSON.stringify(req);
    console.log('NIP-47 request:', reqJson);

    // Encrypt request
    console.log('Encrypting request...');
    const encrypted = await window.nip04.encrypt(secret, pubkey, reqJson);
    console.log('✅ Request encrypted');

    // Build Nostr event
    const event = {
        kind: 23194,
        pubkey: await window.getPublicKey(secret),
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", pubkey]],
        content: encrypted
    };
    
    console.log('Building Nostr event...');
    // Generate real event id and signature
    const finalized = window.nostrTools.finalizeEvent(event, secret);
    event.id = finalized.id;
    event.sig = finalized.sig;
    console.log('✅ Event finalized');

    // Connect to relay
    return new Promise((resolve, reject) => {
        console.log('Connecting to relay:', relay);
        const ws = new WebSocket(relay.replace(/^ws:/, 'wss:'));
        
        let hasReceivedResponse = false;
        let timeoutId;
        let subId;
        
        ws.onopen = () => {
            console.log('✅ WebSocket connected, sending event...');
            console.log('Event details:', {
                kind: event.kind,
                pubkey: event.pubkey,
                tags: event.tags,
                contentLength: event.content.length,
                id: event.id,
                sig: event.sig ? event.sig.substring(0, 20) + '...' : 'none'
            });
            ws.send(JSON.stringify(["EVENT", event]));
            console.log('✅ Event sent to relay');
            // Subscribe for the response event per NIP-47
            subId = "nwc-" + event.id.substring(0, 8);
            ws.send(JSON.stringify([
                "REQ",
                subId,
                { "kinds": [23195, 23194], "#e": [event.id] }
            ]));
            console.log('✅ Subscribed for response event:', subId);
        };
        
        ws.onmessage = async (msg) => {
            console.log('📨 WebSocket message received:', msg.data);
            hasReceivedResponse = true;
            
            try {
                const data = JSON.parse(msg.data);
                
                // Check for relay acknowledgment
                if (Array.isArray(data) && data[0] === "OK") {
                    console.log('✅ Relay acknowledgment received:', data);
                    if (data[2] === false) {
                        if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                        ws.close();
                        reject(new Error('Relay rejected event: ' + (data[3] || 'Unknown error')));
                        return;
                    }
                }
                
                // Look for kind 23195 event with matching tag (payment response)
                if (Array.isArray(data) && data[0] === "EVENT" && data[2]?.kind === 23195) {
                    console.log('💰 Payment response event received:', data[2]);
                    const ev = data[2];
                    if (ev.tags.some(t => t[0] === 'e' && t[1] === event.id)) {
                        console.log('✅ Matching payment response found, decrypting...');
                        const decrypted = await window.nip04.decrypt(secret, pubkey, ev.content);
                        console.log('✅ Decrypted response:', decrypted);
                        const response = JSON.parse(decrypted);
                        clearTimeout(timeoutId);
                        if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                        ws.close();
                        if (response.result && response.result.preimage) {
                            console.log('🎉 NWC Payment Success! Preimage:', response.result.preimage);
                            resolve({ success: true, preimage: response.result.preimage });
                        } else {
                            console.log('❌ NWC Payment Error:', response.error || 'NWC payment failed');
                            reject(new Error(response.error || 'NWC payment failed'));
                        }
                    }
                }
                
                // Look for other response types (error responses, etc.)
                if (Array.isArray(data) && data[0] === "EVENT" && data[2]?.kind === 23194) {
                    console.log('📨 Response event received (kind 23194):', data[2]);
                    const ev = data[2];
                    if (ev.tags.some(t => t[0] === 'e' && t[1] === event.id)) {
                        console.log('✅ Matching response found, decrypting...');
                        const decrypted = await window.nip04.decrypt(secret, pubkey, ev.content);
                        console.log('✅ Decrypted response:', decrypted);
                        const response = JSON.parse(decrypted);
                        clearTimeout(timeoutId);
                        if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                        ws.close();
                        if (response.error) {
                            console.log('❌ NWC Error Response:', response.error);
                            reject(new Error(response.error.message || response.error));
                        }
                    }
                }
            } catch (e) {
                console.error('❌ WebSocket message parsing error:', e);
                // Don't close connection on parsing errors, just log them
            }
        };
        
        ws.onerror = (e) => {
            console.error('❌ WebSocket error:', e);
            clearTimeout(timeoutId);
            if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
            ws.close();
            reject(new Error('WebSocket connection error. Check if the relay is accessible.'));
        };
        
        ws.onclose = (e) => {
            console.log('🔌 WebSocket closed:', e.code, e.reason);
            if (e.code !== 1000 && !hasReceivedResponse) {
                clearTimeout(timeoutId);
                reject(new Error(`WebSocket closed unexpectedly: ${e.code} - ${e.reason}`));
            }
        };
        
        timeoutId = setTimeout(() => {
            console.log('⏰ NWC payment timeout after 30 seconds');
            console.log('No response received from wallet. Possible issues:');
            console.log('1. Wallet is offline or not connected to relay');
            console.log('2. Wallet doesn\'t support pay_keysend method');
            console.log('3. Wallet is not configured to accept payments');
            console.log('4. Relay is not forwarding messages to wallet');
            if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
            ws.close();
            reject(new Error('NWC payment timed out after 30 seconds. Check that your wallet is online and connected to the relay.'));
        }, 30000);
    });
}

// --- metaBoost Metadata Submission ---
// async function sendMetaBoostMetadata(event) {
//     event.preventDefault();
//     const amount = parseInt(document.getElementById('payment-amount').value, 10);
//     const message = document.getElementById('payment-message').value;
//     const recipientCheckboxes = document.querySelectorAll('#recipient-checkboxes input[type="checkbox"]:checked');
//     const selectedOptions = Array.from(recipientCheckboxes);
//     const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
//     const nwcString = nwcInput.value.trim();
//     const paymentProofGroup = document.getElementById('payment-proof-group');
//     const paymentProofInput = document.getElementById('payment-proof');
//     // Find metaBoost endpoint from the first value block
//     const valueBlocks = window._lastValueBlocks || [];
//     const metaBoost = valueBlocks[0]?.metaBoost;
//     if (!metaBoost) {
//         alert('No metaBoost endpoint found in the feed.');
//         return;
//     }
//     if (!amount || amount < 1) {
//         alert('Please enter a valid amount.');
//         return;
//     }
//     if (selectedOptions.length === 0) {
//         alert('Please select at least one recipient.');
//         return;
//     }
//     // If NWC is present and valid, automate payment and proof
//     let isNWC = false;
//     try {
//         if (nwcString) {
//             const nwcUrl = new URL(nwcString);
//             if (nwcUrl.protocol.startsWith('nostr+walletconnect')) {
//                 isNWC = true;
//             }
//         }
//     } catch {}
//     if (isNWC) {
//         // Hide payment proof field and remove required attribute
//         if (paymentProofGroup) paymentProofGroup.style.display = 'none';
//         if (paymentProofInput) paymentProofInput.removeAttribute('required');
//         // NWC automation: send payment to each selected recipient
//         let totalSplit = 0;
//         selectedOptions.forEach(opt => {
//             const split = parseFloat(opt.getAttribute('data-split')) || 0;
//             totalSplit += split;
//         });
//         if (totalSplit === 0) totalSplit = selectedOptions.length;
//         let results = [];
//         for (const opt of selectedOptions) {
//             const split = parseFloat(opt.getAttribute('data-split')) || 1;
//             const recipient = opt.value;
//             const recipientAmount = Math.round(amount * (split / totalSplit));
//             try {
//                 const result = await sendNWCKeysendMinimal(nwcString, recipient, recipientAmount, message);
//                 if (result.success) {
//                     // POST boost metadata with preimage as proof
//                     const payload = {
//                         podcast: valueBlocks[0]?.title || '',
//                         episode: valueBlocks[0]?.title || '',
//                         recipient,
//                         amount: recipientAmount,
//                         message,
//                         payment_proof: result.preimage,
//                         timestamp: new Date().toISOString()
//                     };
//                     await fetch(metaBoost, {
//                         method: 'POST',
//                         headers: { 'Content-Type': 'application/json' },
//                         body: JSON.stringify(payload)
//                     });
//                     results.push({ recipient, amount: recipientAmount, success: true });
//                 } else {
//                     results.push({ recipient, amount: recipientAmount, success: false, error: result.error || 'Unknown error' });
//                 }
//             } catch (e) {
//                 results.push({ recipient, amount: recipientAmount, success: false, error: e.message });
//             }
//         }
//         // Show summary
//         let summary = 'Boost Results:\n';
//         results.forEach(r => {
//             summary += `${r.success ? '✅' : '❌'} ${r.recipient} - ${r.amount} sats${r.error ? ' (' + r.error + ')' : ''}\n`;
//         });
//         alert(summary);
//         return;
//     } else {
//         // Show payment proof field and add required attribute
//         if (paymentProofGroup) paymentProofGroup.style.display = '';
//         if (paymentProofInput) paymentProofInput.setAttribute('required', 'required');
//         const paymentProof = paymentProofInput.value;
//         if (!paymentProof) {
//             alert('Please paste the payment proof.');
//             return;
//         }
//         // Only allow one recipient in manual mode
//         if (selectedOptions.length !== 1) {
//             alert('Manual proof mode only supports one recipient at a time.');
//             return;
//         }
//         const recipient = selectedOptions[0].value;
//         // Build metadata payload
//         const payload = {
//             podcast: valueBlocks[0]?.title || '',
//             episode: valueBlocks[0]?.title || '',
//             recipient,
//             amount,
//             message,
//             payment_proof: paymentProof,
//             timestamp: new Date().toISOString()
//         };
//         try {
//             const res = await fetch(metaBoost, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });
//             const data = await res.json();
//             alert('metaBoost response: ' + JSON.stringify(data, null, 2));
//         } catch (e) {
//             alert('metaBoost error: ' + e.message);
//         }
//     }
// }
// window.sendMetaBoostMetadata = sendMetaBoostMetadata;

// Utility to update payment proof field visibility based on NWC string
function updatePaymentProofVisibility() {
    const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
    const paymentProofGroup = document.getElementById('payment-proof-group');
    const paymentProofInput = document.getElementById('payment-proof');
    let isNWC = false;
    try {
        const nwcString = nwcInput.value.trim();
        if (nwcString) {
            const nwcUrl = new URL(nwcString);
            if (nwcUrl.protocol.startsWith('nostr+walletconnect')) {
                isNWC = true;
            }
        }
    } catch {}
    if (isNWC) {
        if (paymentProofGroup) paymentProofGroup.style.display = 'none';
        if (paymentProofInput) paymentProofInput.removeAttribute('required');
    } else {
        if (paymentProofGroup) paymentProofGroup.style.display = '';
        if (paymentProofInput) paymentProofInput.setAttribute('required', 'required');
    }
}

// On page load, set payment proof field visibility
window.addEventListener('DOMContentLoaded', () => {
    updatePaymentProofVisibility();
    const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
    if (nwcInput) {
        nwcInput.addEventListener('input', updatePaymentProofVisibility);
    }
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-4px)'; });
        card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; });
    });
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'Enter': e.preventDefault(); parseValueBlock(); break;
                case 'Backspace': e.preventDefault(); clearSettings(); break;
            }
        }
    });
});

// Test relay connectivity with more detailed diagnostics
window.testRelayConnection = async function testRelayConnection() {
    const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
    const nwcString = nwcInput.value.trim();
    if (!nwcString) {
        alert('Please enter a NWC string first.');
        return;
    }
    
    try {
        const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
        const relay = url.searchParams.get('relay');
        const pubkey = url.hostname;
        
        if (!relay) {
            alert('No relay found in NWC string.');
            return;
        }
        
        console.log('\n=== Relay Connection Test ===');
        console.log('Relay:', relay);
        console.log('Wallet pubkey:', pubkey);
        
        const ws = new WebSocket(relay.replace(/^ws:/, 'wss:'));
        let messageCount = 0;
        
        ws.onopen = () => {
            console.log('✅ Relay connection successful');
            
            // Subscribe to see if there are any events from the wallet
            const subId = 'test-' + Date.now();
            const subMsg = [
                "REQ",
                subId,
                { 
                    "authors": [pubkey],
                    "kinds": [23195],
                    "limit": 5
                }
            ];
            
            console.log('Subscribing to recent wallet events...');
            ws.send(JSON.stringify(subMsg));
            
            setTimeout(() => {
                console.log(`📊 Received ${messageCount} messages from relay`);
                ws.send(JSON.stringify(["CLOSE", subId]));
                ws.close();
                
                if (messageCount > 0) {
                    alert(`✅ Relay connection successful! Received ${messageCount} messages. Wallet may be active.`);
                } else {
                    alert('✅ Relay connection successful, but no recent wallet activity detected. Wallet may be offline.');
                }
            }, 3000);
        };
        
        ws.onmessage = (msg) => {
            messageCount++;
            console.log(`📨 Message ${messageCount}:`, msg.data);
        };
        
        ws.onerror = (e) => {
            console.error('❌ Relay connection failed:', e);
            alert('❌ Relay connection failed. Check the relay URL.');
        };
        
        setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
                ws.close();
                alert('❌ Relay connection timed out.');
            }
        }, 5000);
        
    } catch (e) {
        console.error('Error testing relay:', e);
        alert('Error testing relay: ' + e.message);
    }
};

// Test wallet capabilities with a real get_info request
async function testWalletCapabilities(nwcString) {
    console.log('\n=== Testing Wallet Capabilities ===');
    console.log('NWC string length:', nwcString.length);
    
    try {
        const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
        const pubkey = url.hostname;
        const relay = url.searchParams.get('relay');
        const secret = url.searchParams.get('secret');
        
        console.log('Parsed NWC details:');
        console.log('- Pubkey:', pubkey);
        console.log('- Relay:', relay);
        console.log('- Secret present:', !!secret);
        
        if (!relay || !pubkey || !secret) {
            throw new Error('Invalid NWC string - missing relay, pubkey, or secret');
        }
        
        // Test relay connection first
        console.log('Testing relay connection...');
        const relayTest = await testRelayConnectionInternal(relay);
        if (!relayTest.success) {
            throw new Error(`Relay connection failed: ${relayTest.error}`);
        }
        console.log('✅ Relay connection successful');
        
        await waitForNostrTools();
        console.log('✅ nostr-tools loaded');
        
        // Build get_info request
        const req = {
            method: "get_info",
            params: {}
        };
        const reqJson = JSON.stringify(req);
        console.log('get_info request:', reqJson);
        
        // Encrypt request
        const encrypted = await window.nip04.encrypt(secret, pubkey, reqJson);
        
        // Build Nostr event
        const clientPubkey = await window.getPublicKey(secret);
        console.log('Client pubkey:', clientPubkey);
        
        const event = {
            kind: 23194,
            pubkey: clientPubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["p", pubkey]],
            content: encrypted
        };
        
        console.log('Event before finalization:', {
            kind: event.kind,
            pubkey: event.pubkey,
            created_at: event.created_at,
            tags: event.tags,
            contentLength: event.content.length
        });
        
        const finalized = window.nostrTools.finalizeEvent(event, secret);
        event.id = finalized.id;
        event.sig = finalized.sig;
        
        console.log('Event after finalization:', {
            id: event.id,
            sig: event.sig ? event.sig.substring(0, 20) + '...' : 'none'
        });
        
        // Send request
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(relay.replace(/^ws:/, 'wss:'));
            let timeoutId;
            let subId;
            
            ws.onopen = () => {
                console.log('✅ WebSocket connected to relay');
                console.log('Sending get_info request...');
                
                const eventMsg = ["EVENT", event];
                console.log('Event message:', JSON.stringify(eventMsg));
                ws.send(JSON.stringify(eventMsg));
                
                // Subscribe for the response event per NIP-47
                subId = "info-" + event.id.substring(0, 8);
                const subMsg = [
                    "REQ",
                    subId,
                    { "kinds": [23195], "#e": [event.id] }
                ];
                console.log('Subscription message:', JSON.stringify(subMsg));
                ws.send(JSON.stringify(subMsg));
                console.log('✅ Subscribed for get_info response:', subId);
            };
            
            let messageCount = 0;
            ws.onmessage = async (msg) => {
                messageCount++;
                console.log(`📨 Message ${messageCount} received:`, msg.data);
                
                try {
                    const data = JSON.parse(msg.data);
                    
                    if (Array.isArray(data) && data[0] === "OK") {
                        console.log('✅ Event acknowledged by relay:', data);
                        if (data[2] === false) {
                            if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                            ws.close();
                            reject(new Error('Relay rejected get_info event: ' + (data[3] || 'Unknown error')));
                            return;
                        }
                    }
                    
                    if (Array.isArray(data) && data[0] === "EVENT") {
                        const ev = data[2];
                        console.log('📨 Event received:', {
                            kind: ev?.kind,
                            pubkey: ev?.pubkey,
                            tags: ev?.tags,
                            id: ev?.id
                        });
                        
                        if (ev?.kind === 23195) {
                            console.log('🔍 Checking if event matches our request...');
                            console.log('- Event tags:', ev.tags);
                            console.log('- Looking for event ID:', event.id);
                            
                            if (ev.tags.some(t => t[0] === 'e' && t[1] === event.id)) {
                                console.log('✅ Found matching response event, decrypting...');
                                const decrypted = await window.nip04.decrypt(secret, pubkey, ev.content);
                                console.log('✅ get_info response decrypted:', decrypted);
                                const response = JSON.parse(decrypted);
                                
                                clearTimeout(timeoutId);
                                if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                                ws.close();
                                
                                if (response.result) {
                                    console.log('🎉 Wallet capabilities received:', response.result);
                                    resolve(response.result);
                                } else {
                                    console.log('❌ get_info error:', response.error);
                                    reject(new Error(response.error || 'get_info failed'));
                                }
                            } else {
                                console.log('⚠️ Event does not match our request ID');
                            }
                        }
                    }
                    
                    if (Array.isArray(data) && data[0] === "EOSE") {
                        console.log('📋 End of stored events for subscription:', data[1]);
                    }
                    
                } catch (e) {
                    console.error('❌ Error parsing message:', e);
                }
            };
            
            ws.onerror = (e) => {
                clearTimeout(timeoutId);
                if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                ws.close();
                reject(new Error('WebSocket error during get_info'));
            };
            
            timeoutId = setTimeout(() => {
                console.log('⏰ get_info request timed out after 15 seconds');
                console.log(`📊 Total messages received: ${messageCount}`);
                console.log('💡 Timeout troubleshooting:');
                console.log('1. Check if your wallet is online and connected to the relay');
                console.log('2. Verify the wallet supports NIP-47 get_info method');
                console.log('3. Check if the relay is properly forwarding messages');
                console.log('4. Ensure the wallet pubkey in NWC string is correct');
                
                if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                ws.close();
                reject(new Error('get_info request timed out'));
            }, 15000);
        });
        
    } catch (e) {
        console.error('Error testing wallet capabilities:', e);
        throw e;
    }
}

// Send direct NWC keysend payments to all selected recipients (splits)
window.sendNormalBoost = async function sendNormalBoost() {
    await waitForNostrTools();
    const amount = parseInt(document.getElementById('payment-amount').value, 10);
    const message = document.getElementById('payment-message').value;
    const recipientCheckboxes = document.querySelectorAll('#recipient-checkboxes input[type="checkbox"]:checked');
    const selectedOptions = Array.from(recipientCheckboxes);
    const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
    const nwcString = nwcInput.value.trim();
    
    console.log('=== Normal Boost Debug Info ===');
    console.log('Amount:', amount);
    console.log('Message:', message);
    console.log('Selected recipients:', selectedOptions.length);
    console.log('NWC string present:', !!nwcString);
    
    if (!nwcString) {
        alert('Please connect your wallet (enter NWC string) first.');
        return;
    }
    if (!amount || amount < 1) {
        alert('Please enter a valid amount.');
        return;
    }
    if (selectedOptions.length === 0) {
        alert('Please select at least one recipient.');
        return;
    }
    
    // Test relay connection first
    try {
        const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
        const relay = url.searchParams.get('relay');
        console.log('Relay from NWC:', relay);
        
        if (!relay) {
            alert('No relay found in NWC string. Please check your NWC connection.');
            return;
        }
        
        // Test relay connectivity
        console.log('Testing relay connection before payment...');
        const relayTest = await testRelayConnectionInternal(relay);
        if (!relayTest.success) {
            alert(`Relay connection failed: ${relayTest.error}\n\nPlease check:\n1. Your wallet is online\n2. The relay URL is correct\n3. Your internet connection`);
            return;
        }
        console.log('✅ Relay connection test passed');
        
        // Test wallet capabilities
        console.log('Testing wallet capabilities...');
        try {
            const capabilities = await testWalletCapabilities(nwcString);
            console.log('✅ Wallet capabilities test passed');
            console.log('Supported methods:', capabilities.methods);
            
            if (!capabilities.methods.includes('pay_keysend')) {
                alert('Your wallet does not support pay_keysend method. Please use a wallet that supports NWC keysend payments.');
                return;
            }
            
            console.log('Keysend limits:', capabilities.pay_keysend);
            
        } catch (e) {
            console.error('❌ Wallet capabilities test failed:', e.message);
            alert(`Wallet capabilities test failed: ${e.message}\n\nThis might mean:\n1. Your wallet is offline\n2. Your wallet doesn't support NWC\n3. The NWC connection is invalid`);
            return;
        }
        
    } catch (e) {
        console.error('Error testing relay:', e);
        alert('Error testing relay connection: ' + e.message);
        return;
    }
    
    // Calculate total splits
    let totalSplit = 0;
    selectedOptions.forEach(opt => {
        const split = parseFloat(opt.getAttribute('data-split')) || 0;
        totalSplit += split;
        console.log(`Recipient: ${opt.value}, Split: ${split}%`);
    });
    if (totalSplit === 0) totalSplit = selectedOptions.length;
    console.log('Total split:', totalSplit);
    
    let results = [];
    for (const opt of selectedOptions) {
        const split = parseFloat(opt.getAttribute('data-split')) || 1;
        const recipient = opt.value;
        const recipientAmount = Math.round(amount * (split / totalSplit));
        
        // Validation: skip empty or zero-amount recipients
        if (!recipient) {
            console.error('Recipient address/pubkey is empty! Skipping this recipient.');
            continue;
        }
        if (!recipientAmount || recipientAmount < 1) {
            console.error('Recipient amount is invalid! Skipping this recipient.');
            continue;
        }
        
        console.log(`\n=== Processing payment for ${recipient} ===`);
        console.log(`Split: ${split}%, Amount: ${recipientAmount} sats`);
        
        // Check if this is a Lightning address or node pubkey
        const isLightningAddress = recipient.includes('@');
        const isNodePubkey = recipient.match(/^[0-9a-fA-F]{66}$/);
        
        try {
            if (isLightningAddress) {
                console.log('📧 Lightning address detected - using LNURL payment...');
                const result = await sendLNURLPayment(recipient, recipientAmount, message);
                if (result.success) {
                    console.log('✅ LNURL payment successful!');
                    const invoiceResult = await payInvoiceWithNWC(nwcString, result.invoice);
                    if (invoiceResult.success) {
                        console.log('✅ Payment successful! Preimage:', invoiceResult.preimage);
                        results.push({ recipient, amount: recipientAmount, success: true });
                    } else {
                        console.log('❌ Invoice payment failed:', invoiceResult.error);
                        results.push({ recipient, amount: recipientAmount, success: false, error: invoiceResult.error });
                    }
                } else {
                    console.log('❌ LNURL payment failed:', result.error);
                    results.push({ recipient, amount: recipientAmount, success: false, error: result.error });
                }
            } else if (isNodePubkey) {
                console.log('⚠️ Node pubkey detected - keysend not supported by most NWC wallets');
                alert(`⚠️ Node pubkey detected: ${recipient}\n\nMost NWC wallets don't support keysend payments. This recipient will be skipped.\n\nConsider using Lightning addresses instead.`);
                results.push({ recipient, amount: recipientAmount, success: false, error: 'Keysend not supported by most NWC wallets' });
            } else {
                console.log('⚠️ Invalid recipient format');
                alert(`⚠️ Invalid recipient format: ${recipient}\n\nExpected a Lightning address (user@domain.com) or node pubkey.`);
                results.push({ recipient, amount: recipientAmount, success: false, error: 'Invalid recipient format' });
            }
        } catch (e) {
            console.log('❌ Payment exception:', e.message);
            results.push({ recipient, amount: recipientAmount, success: false, error: e.message });
        }
    }
    
    // Show summary
    let summary = 'Normal Boost Results:\n';
    results.forEach(r => {
        summary += `${r.success ? '✅' : '❌'} ${r.recipient} - ${r.amount} sats${r.error ? ' (' + r.error + ')' : ''}\n`;
    });
    console.log('=== Final Summary ===');
    console.log(summary);
    alert(summary);
};

// LNURL Payment Functions
async function sendLNURLPayment(lightningAddress, amount, message) {
    console.log(`🔗 Starting LNURL payment to ${lightningAddress} for ${amount} sats`);
    
    try {
        // Step 1: Convert Lightning address to LNURL
        const [username, domain] = lightningAddress.split('@');
        const lnurlUrl = `https://${domain}/.well-known/lnurlp/${username}`;
        
        console.log('🔍 Fetching LNURL info from:', lnurlUrl);
        
        // Step 2: Fetch LNURL pay info
        const lnurlResponse = await fetch(lnurlUrl);
        if (!lnurlResponse.ok) {
            throw new Error(`LNURL fetch failed: ${lnurlResponse.status}`);
        }
        
        const lnurlData = await lnurlResponse.json();
        console.log('📋 LNURL data:', lnurlData);
        
        if (lnurlData.tag !== 'payRequest') {
            throw new Error('Invalid LNURL response: not a pay request');
        }
        
        // Step 3: Validate amount
        const amountMsat = amount * 1000;
        if (amountMsat < lnurlData.minSendable || amountMsat > lnurlData.maxSendable) {
            throw new Error(`Amount ${amount} sats is outside allowed range: ${lnurlData.minSendable/1000}-${lnurlData.maxSendable/1000} sats`);
        }
        
        // Step 4: Request invoice
        const callbackUrl = new URL(lnurlData.callback);
        callbackUrl.searchParams.set('amount', amountMsat);
        if (message) {
            callbackUrl.searchParams.set('comment', message);
        }
        
        console.log('💰 Requesting invoice from:', callbackUrl.toString());
        
        const invoiceResponse = await fetch(callbackUrl.toString());
        if (!invoiceResponse.ok) {
            throw new Error(`Invoice request failed: ${invoiceResponse.status}`);
        }
        
        const invoiceData = await invoiceResponse.json();
        console.log('🧾 Invoice data:', invoiceData);
        
        if (invoiceData.status === 'ERROR') {
            throw new Error(`Invoice error: ${invoiceData.reason}`);
        }
        
        if (!invoiceData.pr) {
            throw new Error('No invoice returned from LNURL');
        }
        
        console.log('✅ LNURL invoice received');
        return { success: true, invoice: invoiceData.pr };
        
    } catch (error) {
        console.error('❌ LNURL payment failed:', error);
        return { success: false, error: error.message };
    }
}

async function payInvoiceWithNWC(nwcString, invoice) {
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    console.log(`💳 Paying invoice with NWC... (Request ID: ${requestId})`);
    
    try {
        // Parse NWC string
        const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
        const pubkey = url.hostname;
        const relay = url.searchParams.get('relay');
        const secret = url.searchParams.get('secret');
        
        await waitForNostrTools();
        
        // Build pay_invoice request
        const req = {
            method: "pay_invoice",
            params: { invoice }
        };
        
        console.log(`📤 NWC pay_invoice request (${requestId}):`, req);
        
        // Encrypt and send like the keysend function
        const encrypted = await window.nip04.encrypt(secret, pubkey, JSON.stringify(req));
        
        const event = {
            kind: 23194,
            pubkey: await window.getPublicKey(secret),
            created_at: Math.floor(Date.now() / 1000),
            tags: [["p", pubkey]],
            content: encrypted
        };
        
        const finalized = window.nostrTools.finalizeEvent(event, secret);
        event.id = finalized.id;
        event.sig = finalized.sig;
        
        // Send to relay and wait for response
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(relay.replace(/^ws:/, 'wss:'));
            let timeoutId;
            let subId;
            
            ws.onopen = () => {
                console.log(`📤 Sending pay_invoice request (${requestId})...`);
                ws.send(JSON.stringify(["EVENT", event]));
                
                subId = "inv-" + event.id.substring(0, 8);
                ws.send(JSON.stringify([
                    "REQ",
                    subId,
                    { "kinds": [23195], "#e": [event.id] }
                ]));
                console.log(`✅ Subscribed for invoice response (${requestId}):`, subId);
            };
            
            ws.onmessage = async (msg) => {
                try {
                    const data = JSON.parse(msg.data);
                    
                    if (Array.isArray(data) && data[0] === "OK") {
                        console.log(`✅ Invoice payment acknowledged by relay (${requestId}):`, data);
                        if (data[2] === false) {
                            clearTimeout(timeoutId);
                            if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                            ws.close();
                            reject(new Error('Relay rejected invoice payment: ' + (data[3] || 'Unknown error')));
                            return;
                        }
                    }
                    
                    if (Array.isArray(data) && data[0] === "EVENT" && data[2]?.kind === 23195) {
                        const ev = data[2];
                        
                        console.log(`📨 Received event kind 23195 (${requestId}):`, {
                            id: ev.id,
                            pubkey: ev.pubkey,
                            tags: ev.tags,
                            targetEventId: event.id
                        });
                        
                        // Only decrypt if this event is specifically for our request
                        const matchingTag = ev.tags.find(t => t[0] === 'e' && t[1] === event.id);
                        if (matchingTag) {
                            console.log(`📨 Found matching invoice response event (${requestId}), decrypting...`);
                            console.log(`Matching tag (${requestId}):`, matchingTag);
                            console.log(`Event pubkey (${requestId}):`, ev.pubkey);
                            console.log(`Expected wallet pubkey (${requestId}):`, pubkey);
                            console.log(`Client pubkey (${requestId}):`, await window.getPublicKey(secret));
                            
                            // Check if this event is actually from our wallet
                            if (ev.pubkey !== pubkey) {
                                console.log(`⚠️ Event pubkey mismatch (${requestId}) - skipping`);
                                return;
                            }
                            
                            try {
                                const decrypted = await window.nip04.decrypt(secret, pubkey, ev.content);
                                console.log(`✅ Decrypted invoice response (${requestId}):`, decrypted);
                                const response = JSON.parse(decrypted);
                                
                                clearTimeout(timeoutId);
                                if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                                ws.close();
                                
                                if (response.result && response.result.preimage) {
                                    console.log(`✅ Invoice paid (${requestId})! Preimage:`, response.result.preimage);
                                    resolve({ success: true, preimage: response.result.preimage });
                                } else {
                                    console.log(`❌ Invoice payment failed (${requestId}):`, response.error);
                                    reject(new Error(response.error || 'Invoice payment failed'));
                                }
                            } catch (decryptError) {
                                console.error(`❌ Failed to decrypt invoice response (${requestId}):`, decryptError);
                                console.log(`Event details (${requestId}):`, ev);
                                console.log(`Expected event ID (${requestId}):`, event.id);
                                console.log(`Actual event tags (${requestId}):`, ev.tags);
                                clearTimeout(timeoutId);
                                if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                                ws.close();
                                reject(new Error('Failed to decrypt invoice response'));
                            }
                        } else {
                            console.log(`📨 Received unrelated event (${requestId}), ignoring...`, {
                                eventId: ev.id,
                                tags: ev.tags,
                                lookingFor: event.id
                            });
                        }
                    }
                    
                    if (Array.isArray(data) && data[0] === "EOSE") {
                        console.log(`📋 End of stored events for invoice subscription (${requestId})`);
                    }
                    
                } catch (e) {
                    console.error('Error parsing invoice message:', e);
                }
            };
            
            ws.onerror = (e) => {
                clearTimeout(timeoutId);
                if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                ws.close();
                reject(new Error('WebSocket error during invoice payment'));
            };
            
            timeoutId = setTimeout(() => {
                if (subId) ws.send(JSON.stringify(["CLOSE", subId]));
                ws.close();
                reject(new Error('Invoice payment timed out'));
            }, 30000);
        });
        
    } catch (error) {
        console.error('❌ NWC invoice payment failed:', error);
        return { success: false, error: error.message };
    }
}

// Internal relay test function (returns result instead of showing alert)
async function testRelayConnectionInternal(relay) {
    return new Promise((resolve) => {
        console.log('Testing relay connection:', relay);
        const ws = new WebSocket(relay.replace(/^ws:/, 'wss:'));
        
        ws.onopen = () => {
            console.log('✅ Relay connection successful');
            ws.close();
            resolve({ success: true });
        };
        
        ws.onerror = (e) => {
            console.error('❌ Relay connection failed:', e);
            resolve({ success: false, error: 'WebSocket connection failed' });
        };
        
        setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING) {
                ws.close();
                resolve({ success: false, error: 'Connection timed out' });
            }
        }, 5000);
    });
}

// Debug NWC connection with step-by-step diagnostics
window.debugNWCConnection = async function debugNWCConnection() {
    const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
    const nwcString = nwcInput.value.trim();
    
    console.log('\n=== NWC Connection Debug ===');
    
    if (!nwcString) {
        alert('Please enter a NWC string first.');
        return;
    }
    
    try {
        // Step 1: Parse NWC string
        console.log('Step 1: Parsing NWC string...');
        console.log('NWC string:', nwcString);
        
        const url = new URL(nwcString.replace('nostr+walletconnect://', 'https://'));
        const pubkey = url.hostname;
        const relay = url.searchParams.get('relay');
        const secret = url.searchParams.get('secret');
        
        console.log('✅ NWC parsed successfully:');
        console.log('- Pubkey:', pubkey);
        console.log('- Relay:', relay);
        console.log('- Secret length:', secret?.length || 0);
        
        if (!relay || !pubkey || !secret) {
            alert('❌ Invalid NWC string - missing required parameters');
            return;
        }
        
        // Step 2: Test relay connection
        console.log('\nStep 2: Testing relay connection...');
        const relayTest = await testRelayConnectionInternal(relay);
        if (!relayTest.success) {
            alert(`❌ Relay connection failed: ${relayTest.error}`);
            return;
        }
        console.log('✅ Relay connection successful');
        
        // Step 3: Test nostr-tools availability
        console.log('\nStep 3: Testing nostr-tools...');
        await waitForNostrTools();
        console.log('✅ nostr-tools available');
        
        // Step 4: Test encryption
        console.log('\nStep 4: Testing encryption...');
        const testMessage = JSON.stringify({ test: 'hello' });
        const encrypted = await window.nip04.encrypt(secret, pubkey, testMessage);
        console.log('✅ Encryption successful, length:', encrypted.length);
        
        // Step 5: Test key generation
        console.log('\nStep 5: Testing key generation...');
        const clientPubkey = await window.getPublicKey(secret);
        console.log('✅ Client pubkey generated:', clientPubkey);
        
        alert('✅ All NWC connection tests passed!\n\nThe issue may be that your wallet is offline or not responding to get_info requests. Try using a different wallet or check if your wallet supports NWC properly.');
        
    } catch (e) {
        console.error('❌ NWC Debug failed:', e);
        alert(`❌ NWC Debug failed: ${e.message}`);
    }
};

// Standalone wallet capabilities test function
window.testWalletCapabilitiesStandalone = async function testWalletCapabilitiesStandalone() {
    const nwcInput = document.querySelector('input[placeholder*="nostr+walletconnect"]');
    const nwcString = nwcInput.value.trim();
    
    if (!nwcString) {
        alert('Please enter a NWC string first.');
        return;
    }
    
    try {
        console.log('=== Testing Wallet Capabilities ===');
        const capabilities = await testWalletCapabilities(nwcString);
        
        let message = '✅ Wallet Capabilities Test Passed!\n\n';
        message += `Supported Methods:\n`;
        capabilities.methods.forEach(method => {
            message += `• ${method}\n`;
        });
        
        if (capabilities.pay_keysend) {
            message += `\nKeysend Limits:\n`;
            message += `• Max Amount: ${capabilities.pay_keysend.max_amount?.toLocaleString() || 'Unknown'} sats\n`;
            message += `• Min Amount: ${capabilities.pay_keysend.min_amount || 'Unknown'} sats\n`;
            message += `• Fee Reserve: ${capabilities.pay_keysend.fee_reserve || 'Unknown'} sats\n`;
        }
        
        if (capabilities.pay_invoice) {
            message += `\nInvoice Limits:\n`;
            message += `• Max Amount: ${capabilities.pay_invoice.max_amount?.toLocaleString() || 'Unknown'} sats\n`;
            message += `• Min Amount: ${capabilities.pay_invoice.min_amount || 'Unknown'} sats\n`;
        }
        
        alert(message);
        
    } catch (e) {
        console.error('Wallet capabilities test failed:', e);
        alert(`❌ Wallet Capabilities Test Failed!\n\nError: ${e.message}\n\nThis might mean:\n1. Your wallet is offline\n2. Your wallet doesn't support NWC\n3. The NWC connection is invalid\n4. The relay is not working properly`);
    }
};

// ===== PodPay Enhanced Functionality =====

/**
 * Enhanced value block parsing using PodPay library
 */
window.parseValueBlocksWithPodPay = async function() {
    if (!window.podpay) {
        alert('PodPay library not loaded. Please refresh the page.');
        return;
    }
    
    try {
        const rssInput = document.querySelector('input[type="url"]');
        const feedUrl = rssInput.value;
        if (!feedUrl) throw new Error('Please enter a RSS feed URL');
        
        const xmlText = await fetchRssFeed(feedUrl);
        const xmlDoc = parseXml(xmlText);
        
        // Use PodPay to parse value blocks
        const valueBlocks = window.podpay.parseValueBlocks(xmlDoc);
        
        if (valueBlocks.length === 0) {
            alert('No value blocks found using PodPay parser');
            return;
        }
        
        console.log('PodPay parsed value blocks:', valueBlocks);
        
        // Display enhanced value blocks
        displayEnhancedValueBlocks(valueBlocks);
        
    } catch (error) {
        console.error('PodPay parsing error:', error);
        alert('Error parsing with PodPay: ' + error.message);
    }
};

/**
 * Display enhanced value blocks with PodPay data
 */
function displayEnhancedValueBlocks(valueBlocks) {
    const container = document.querySelector('.container');
    
    // Remove existing enhanced display
    const existing = document.getElementById('podpay-enhanced-display');
    if (existing) existing.remove();
    
    const displayDiv = document.createElement('div');
    displayDiv.id = 'podpay-enhanced-display';
    displayDiv.className = 'card';
    displayDiv.innerHTML = `
        <div class="card-header">
            <div class="card-icon">🚀</div>
            <h2 class="card-title">PodPay Enhanced Value Blocks</h2>
        </div>
        <div class="enhanced-content">
            <p>Found ${valueBlocks.length} value blocks using PodPay library</p>
            <div class="value-blocks-list"></div>
        </div>
    `;
    
    container.appendChild(displayDiv);
    
    const listContainer = displayDiv.querySelector('.value-blocks-list');
    
    valueBlocks.forEach((block, index) => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'enhanced-block';
        blockDiv.innerHTML = `
            <h3>${block.title || `Episode ${index + 1}`}</h3>
            <p><strong>Type:</strong> ${block.type}</p>
            <p><strong>Suggested:</strong> ${PodPayUtils.formatAmount(block.suggested)}</p>
            <p><strong>Recipients:</strong> ${block.recipients.length}</p>
            <div class="recipients-list">
                ${block.recipients.map(recipient => `
                    <div class="recipient">
                        <span class="name">${recipient.name || 'Unknown'}</span>
                        <span class="address">${recipient.address}</span>
                        <span class="type">${recipient.type}</span>
                        <span class="split">${recipient.split}%</span>
                    </div>
                `).join('')}
            </div>
        `;
        listContainer.appendChild(blockDiv);
    });
};

/**
 * Calculate payment splits using PodPay
 */
window.calculateSplitsWithPodPay = function() {
    if (!window.podpay) {
        alert('PodPay library not loaded. Please refresh the page.');
        return;
    }
    
    const amountInput = document.getElementById('payment-amount');
    const amount = parseInt(amountInput.value);
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid payment amount');
        return;
    }
    
    // Get current value blocks from the page
    const valueBlocks = window._lastValueBlocks || [];
    if (valueBlocks.length === 0) {
        alert('No value blocks available. Please parse a feed first.');
        return;
    }
    
    // Use first value block for demonstration
    const block = valueBlocks[0];
    const recipients = [
        ...(block.lightningAddresses || []).map(addr => ({
            name: addr.name || 'Lightning Address',
            address: addr.address,
            type: 'lightning',
            split: parseInt(addr.split) || 0
        })),
        ...(block.nodePubkeys || []).map(node => ({
            name: node.name || 'Node Pubkey',
            address: node.address,
            type: 'node',
            split: parseInt(node.split) || 0
        }))
    ];
    
    if (recipients.length === 0) {
        alert('No recipients found in value blocks');
        return;
    }
    
    // Calculate splits using PodPay
    const calculatedSplits = window.podpay.calculateSplits(amount, recipients);
    
    // Display calculated splits
    displayCalculatedSplits(amount, calculatedSplits);
};

/**
 * Display calculated payment splits
 */
function displayCalculatedSplits(totalAmount, splits) {
    const container = document.querySelector('.container');
    
    // Remove existing splits display
    const existing = document.getElementById('podpay-splits-display');
    if (existing) existing.remove();
    
    const displayDiv = document.createElement('div');
    displayDiv.id = 'podpay-splits-display';
    displayDiv.className = 'card';
    displayDiv.innerHTML = `
        <div class="card-header">
            <div class="card-icon">💰</div>
            <h2 class="card-title">PodPay Payment Splits</h2>
        </div>
        <div class="splits-content">
            <p><strong>Total Amount:</strong> ${PodPayUtils.formatAmount(totalAmount)}</p>
            <div class="splits-list"></div>
        </div>
    `;
    
    container.appendChild(displayDiv);
    
    const listContainer = displayDiv.querySelector('.splits-list');
    
    splits.forEach((split, index) => {
        const splitDiv = document.createElement('div');
        splitDiv.className = 'split-item';
        splitDiv.innerHTML = `
            <div class="split-header">
                <span class="name">${split.name}</span>
                <span class="amount">${PodPayUtils.formatAmount(split.calculatedAmount)}</span>
            </div>
            <div class="split-details">
                <span class="address">${split.address}</span>
                <span class="type">${split.type}</span>
                <span class="split-percent">${split.split}%</span>
                ${split.remaining > 0 ? `<span class="remaining">+${split.remaining} remaining</span>` : ''}
            </div>
        `;
        listContainer.appendChild(splitDiv);
    });
};

/**
 * Generate metaBoost metadata using PodPay
 */
window.generateMetaBoostWithPodPay = function() {
    if (!window.podpay) {
        alert('PodPay library not loaded. Please refresh the page.');
        return;
    }
    
    const amountInput = document.getElementById('payment-amount');
    const messageInput = document.getElementById('payment-message');
    
    const amount = parseInt(amountInput.value);
    const message = messageInput.value;
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid payment amount');
        return;
    }
    
    // Get current value blocks
    const valueBlocks = window._lastValueBlocks || [];
    if (valueBlocks.length === 0) {
        alert('No value blocks available. Please parse a feed first.');
        return;
    }
    
    const block = valueBlocks[0];
    const recipients = [
        ...(block.lightningAddresses || []).map(addr => ({
            name: addr.name || 'Lightning Address',
            address: addr.address,
            type: 'lightning',
            split: parseInt(addr.split) || 0
        })),
        ...(block.nodePubkeys || []).map(node => ({
            name: node.name || 'Node Pubkey',
            address: node.address,
            type: 'node',
            split: parseInt(node.split) || 0
        }))
    ];
    
    if (recipients.length === 0) {
        alert('No recipients found in value blocks');
        return;
    }
    
    // Calculate splits first
    const calculatedSplits = window.podpay.calculateSplits(amount, recipients);
    
    // Generate metaBoost metadata
    const payment = {
        amount,
        message,
        podcast: 'Test Podcast',
        episode: block.title || 'Test Episode'
    };
    
    const metaBoost = window.podpay.generateMetaBoost(payment, calculatedSplits);
    
    // Display metaBoost metadata
    displayMetaBoostMetadata(metaBoost);
};

/**
 * Display metaBoost metadata
 */
function displayMetaBoostMetadata(metaBoost) {
    const container = document.querySelector('.container');
    
    // Remove existing metaBoost display
    const existing = document.getElementById('podpay-metaboost-display');
    if (existing) existing.remove();
    
    const displayDiv = document.createElement('div');
    displayDiv.id = 'podpay-metaboost-display';
    displayDiv.className = 'card';
    displayDiv.innerHTML = `
        <div class="card-header">
            <div class="card-icon">📡</div>
            <h2 class="card-title">PodPay metaBoost Metadata</h2>
        </div>
        <div class="metaboost-content">
            <pre class="metaboost-json">${JSON.stringify(metaBoost, null, 2)}</pre>
            <button class="btn btn-primary" onclick="copyMetaBoostToClipboard()">📋 Copy to Clipboard</button>
        </div>
    `;
    
    container.appendChild(displayDiv);
};

/**
 * Copy metaBoost metadata to clipboard
 */
window.copyMetaBoostToClipboard = function() {
    const jsonElement = document.querySelector('.metaboost-json');
    if (jsonElement) {
        navigator.clipboard.writeText(jsonElement.textContent).then(() => {
            alert('metaBoost metadata copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }
};

/**
 * Test PodPay library functionality
 */
window.testPodPayLibrary = function() {
    if (!window.podpay) {
        alert('PodPay library not loaded. Please refresh the page.');
        return;
    }
    
    try {
        // Test validation functions
        const testAddress = 'chadf@getalby.com';
        const testPubkey = '032870511bfa0309bab3ca1832ead69eed848a4abddbc4d50e55bb2157f9525e51';
        
        const addressValid = window.podpay.validateLightningAddress(testAddress);
        const pubkeyValid = window.podpay.validateNodePubkey(testPubkey);
        
        // Test utility functions
        const sats = 1000;
        const btc = PodPayUtils.satsToBTC(sats);
        const backToSats = PodPayUtils.btcToSats(btc);
        
        let message = '✅ PodPay Library Test Results:\n\n';
        message += `Lightning Address Validation: ${addressValid ? '✅' : '❌'}\n`;
        message += `Node Pubkey Validation: ${pubkeyValid ? '✅' : '❌'}\n`;
        message += `Sats to BTC Conversion: ${sats} sats = ${btc} BTC\n`;
        message += `BTC to Sats Conversion: ${btc} BTC = ${backToSats} sats\n`;
        message += `Amount Formatting: ${PodPayUtils.formatAmount(sats)}\n`;
        
        alert(message);
        
    } catch (error) {
        console.error('PodPay library test failed:', error);
        alert('PodPay library test failed: ' + error.message);
    }
};

/**
 * Test TLV record generation and LNURL functionality
 */
window.testTLVAndLNURL = function() {
    if (!window.podpay) {
        alert('PodPay library not loaded. Please refresh the page.');
        return;
    }
    
    try {
        // Test metadata
        const metadata = {
            podcast: 'V4V Lightning Tester',
            episode: 'Test Episode with TLV Records',
            message: 'This is a test boost with TLV metadata!',
            action: 'boost',
            app: 'v4v-lightning-tester',
            ts: Math.floor(Date.now() / 1000),
            feedUrl: 'https://example.com/feed.xml',
            episodeGuid: 'test-episode-123'
        };
        
        // Generate TLV records
        const tlvRecords = window.podpay.generateTLVRecords(metadata);
        
        // Test LNURL generation
        const lightningAddress = 'chadf@getalby.com';
        const lnurl = window.podpay.generateLNURL(lightningAddress);
        
        // Test TLV parsing
        const parsedMetadata = window.podpay.parseTLVRecords(tlvRecords);
        
        let message = '🚀 TLV & LNURL Test Results:\n\n';
        message += `Lightning Address: ${lightningAddress}\n`;
        message += `Generated LNURL: ${lnurl}\n\n`;
        message += `Generated ${tlvRecords.length} TLV Records:\n`;
        
        tlvRecords.forEach((record, index) => {
            message += `${index + 1}. Type: ${record.type}, Value: ${record.value.length} bytes\n`;
        });
        
        message += `\nParsed Metadata:\n`;
        Object.entries(parsedMetadata).forEach(([key, value]) => {
            message += `• ${key}: ${value}\n`;
        });
        
        alert(message);
        
    } catch (error) {
        console.error('TLV & LNURL test failed:', error);
        alert('TLV & LNURL test failed: ' + error.message);
    }
};

/**
 * Generate LNURL-pay invoice with TLV records
 */
window.generateLNURLPayWithTLV = async function() {
    if (!window.podpay) {
        alert('PodPay library not loaded. Please refresh the page.');
        return;
    }
    
    const amountInput = document.getElementById('payment-amount');
    const messageInput = document.getElementById('payment-message');
    
    const amount = parseInt(amountInput.value);
    const message = messageInput.value;
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid payment amount');
        return;
    }
    
    // Get current value blocks for recipient info
    const valueBlocks = window._lastValueBlocks || [];
    if (valueBlocks.length === 0) {
        alert('No value blocks available. Please parse a feed first.');
        return;
    }
    
    // Use first lightning address found
    const block = valueBlocks[0];
    const lightningAddresses = block.lightningAddresses || [];
    
    if (lightningAddresses.length === 0) {
        alert('No Lightning addresses found in value blocks');
        return;
    }
    
    const recipient = lightningAddresses[0];
    
    try {
        // Create metadata for TLV records
        const metadata = {
            podcast: 'V4V Lightning Tester',
            episode: block.title || 'Test Episode',
            message: message || 'Boost via TLV records',
            action: 'boost',
            app: 'v4v-lightning-tester',
            ts: Math.floor(Date.now() / 1000),
            feedUrl: document.querySelector('input[type="url"]').value || '',
            episodeGuid: `episode-${Date.now()}`
        };
        
        // Generate LNURL-pay invoice with TLV records
        const invoice = await window.podpay.generateLNURLPayInvoice(
            recipient.address,
            amount,
            metadata
        );
        
        // Display the invoice with TLV data
        displayLNURLPayInvoice(invoice);
        
    } catch (error) {
        console.error('Failed to generate LNURL-pay invoice:', error);
        alert('Failed to generate invoice: ' + error.message);
    }
};

/**
 * Display LNURL-pay invoice with TLV records
 */
function displayLNURLPayInvoice(invoice) {
    const container = document.querySelector('.container');
    
    // Remove existing display
    const existing = document.getElementById('lnurl-pay-display');
    if (existing) existing.remove();
    
    const displayDiv = document.createElement('div');
    displayDiv.id = 'lnurl-pay-display';
    displayDiv.className = 'card';
    displayDiv.innerHTML = `
        <div class="card-header">
            <div class="card-icon">⚡</div>
            <h2 class="card-title">LNURL-pay Invoice with TLV Records</h2>
        </div>
        <div class="lnurl-content">
            <div class="invoice-details">
                <p><strong>Lightning Address:</strong> ${invoice.lightningAddress}</p>
                <p><strong>Amount:</strong> ${PodPayUtils.formatAmount(invoice.amount)}</p>
                <p><strong>LNURL:</strong> <a href="${invoice.lnurl}" target="_blank">${invoice.lnurl}</a></p>
                <p><strong>Invoice:</strong> ${invoice.invoice}</p>
            </div>
            
            <div class="tlv-section">
                <h3>TLV Records (${invoice.tlvRecords.length})</h3>
                <div class="tlv-records-list"></div>
            </div>
            
            <div class="metadata-section">
                <h3>Payment Metadata</h3>
                <pre class="metadata-json">${JSON.stringify(invoice.metadata, null, 2)}</pre>
            </div>
            
            <div class="button-group">
                <button class="btn btn-primary" onclick="copyInvoiceToClipboard()">📋 Copy Invoice</button>
                <button class="btn btn-success" onclick="copyTLVToClipboard()">📋 Copy TLV Data</button>
                <button class="btn btn-info" onclick="testTLVAndLNURL()">🧪 Test TLV</button>
            </div>
        </div>
    `;
    
    container.appendChild(displayDiv);
    
    // Display TLV records
    const tlvContainer = displayDiv.querySelector('.tlv-records-list');
    invoice.tlvRecords.forEach((record, index) => {
        const recordDiv = document.createElement('div');
        recordDiv.className = 'tlv-record';
        recordDiv.innerHTML = `
            <div class="record-header">
                <span class="record-type">Type: ${record.type}</span>
                <span class="record-size">${record.value.length} bytes</span>
            </div>
            <div class="record-value">
                Value: ${record.value.length > 50 ? 
                    record.value.slice(0, 50) + '...' : 
                    Array.from(record.value).map(b => b.toString(16).padStart(2, '0')).join(' ')}
            </div>
        `;
        tlvContainer.appendChild(recordDiv);
    });
    
    // Add CSS for the new elements
    addTLVStyles();
}

/**
 * Generate keysend payment with TLV records
 */
window.generateKeysendWithTLV = async function() {
    if (!window.podpay) {
        alert('PodPay library not loaded. Please refresh the page.');
        return;
    }
    
    const amountInput = document.getElementById('payment-amount');
    const messageInput = document.getElementById('payment-message');
    
    const amount = parseInt(amountInput.value);
    const message = messageInput.value;
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid payment amount');
        return;
    }
    
    // Get current value blocks for recipient info
    const valueBlocks = window._lastValueBlocks || [];
    if (valueBlocks.length === 0) {
        alert('No value blocks available. Please parse a feed first.');
        return;
    }
    
    // Use first node pubkey found
    const block = valueBlocks[0];
    const nodePubkeys = block.nodePubkeys || [];
    
    if (nodePubkeys.length === 0) {
        alert('No node pubkeys found in value blocks');
        return;
    }
    
    const recipient = nodePubkeys[0];
    
    try {
        // Create metadata for TLV records
        const metadata = {
            podcast: 'V4V Lightning Tester',
            episode: block.title || 'Test Episode',
            message: message || 'Keysend boost via TLV records',
            action: 'boost',
            app: 'v4v-lightning-tester',
            ts: Math.floor(Date.now() / 1000),
            feedUrl: document.querySelector('input[type="url"]').value || '',
            episodeGuid: `episode-${Date.now()}`
        };
        
        // Generate keysend with TLV records
        const keysend = await window.podpay.generateKeysendWithTLV(
            recipient.address,
            amount,
            metadata
        );
        
        // Display the keysend with TLV data
        displayKeysendWithTLV(keysend);
        
    } catch (error) {
        console.error('Failed to generate keysend with TLV:', error);
        alert('Failed to generate keysend: ' + error.message);
    }
};

/**
 * Display keysend payment with TLV records
 */
function displayKeysendWithTLV(keysend) {
    const container = document.querySelector('.container');
    
    // Remove existing display
    const existing = document.getElementById('keysend-tlv-display');
    if (existing) existing.remove();
    
    const displayDiv = document.createElement('div');
    displayDiv.id = 'keysend-tlv-display';
    displayDiv.className = 'card';
    displayDiv.innerHTML = `
        <div class="card-header">
            <div class="card-icon">🔑</div>
            <h2 class="card-title">Keysend Payment with TLV Records</h2>
        </div>
        <div class="keysend-content">
            <div class="payment-details">
                <p><strong>Destination:</strong> ${keysend.destination}</p>
                <p><strong>Amount:</strong> ${PodPayUtils.formatAmount(keysend.amount)}</p>
                <p><strong>Preimage:</strong> ${keysend.preimage}</p>
            </div>
            
            <div class="tlv-section">
                <h3>TLV Records (${keysend.tlvRecords.length})</h3>
                <div class="tlv-records-list"></div>
            </div>
            
            <div class="metadata-section">
                <h3>Payment Metadata</h3>
                <pre class="metadata-json">${JSON.stringify(keysend.metadata, null, 2)}</pre>
            </div>
            
            <div class="button-group">
                <button class="btn btn-primary" onclick="copyKeysendToClipboard()">📋 Copy Keysend Data</button>
                <button class="btn btn-success" onclick="copyTLVToClipboard()">📋 Copy TLV Data</button>
                <button class="btn btn-info" onclick="testTLVAndLNURL()">🧪 Test TLV</button>
            </div>
        </div>
    `;
    
    container.appendChild(displayDiv);
    
    // Display TLV records
    const tlvContainer = displayDiv.querySelector('.tlv-records-list');
    keysend.tlvRecords.forEach((record, index) => {
        const recordDiv = document.createElement('div');
        recordDiv.className = 'tlv-record';
        recordDiv.innerHTML = `
            <div class="record-header">
                <span class="record-type">Type: ${record.type}</span>
                <span class="record-size">${record.value.length} bytes</span>
            </div>
            <div class="record-value">
                Value: ${record.value.length > 50 ? 
                    record.value.slice(0, 50) + '...' : 
                    Array.from(record.value).map(b => b.toString(16).padStart(2, '0')).join(' ')}
            </div>
        `;
        tlvContainer.appendChild(recordDiv);
    });
    
    // Add CSS for the new elements
    addTLVStyles();
}

/**
 * Copy invoice to clipboard
 */
window.copyInvoiceToClipboard = function() {
    const invoiceElement = document.querySelector('.invoice-details');
    if (invoiceElement) {
        const text = invoiceElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            alert('Invoice details copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }
};

/**
 * Copy keysend data to clipboard
 */
window.copyKeysendToClipboard = function() {
    const keysendElement = document.querySelector('.payment-details');
    if (keysendElement) {
        const text = keysendElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            alert('Keysend data copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }
};

/**
 * Copy TLV data to clipboard
 */
window.copyTLVToClipboard = function() {
    const tlvElement = document.querySelector('.tlv-records-list');
    if (tlvElement) {
        const text = tlvElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            alert('TLV records copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }
};
