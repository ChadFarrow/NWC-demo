// MetaBoost fix script - loaded externally to bypass caching
console.log('🔧 Loading metaBoost fix script...');

// Create global function for onclick handlers
window.handleMetaBoostSubmit = function(event) {
    console.log('🚀 handleMetaBoostSubmit called via global function');
    event.preventDefault();
    // Trigger click on the properly configured button
    const container = document.getElementById('payment-form-container');
    if (container) {
        const fixedBtn = container.querySelector('.metaboost-fixed-btn');
        if (fixedBtn) {
            fixedBtn.click();
        }
    }
};

// Wait for page to load
window.addEventListener('load', function() {
    setTimeout(function() {
        console.log('🔍 Looking for metaBoost form elements...');
        
        // Find the payment form container
        const container = document.getElementById('payment-form-container');
        if (!container) {
            console.log('❌ payment-form-container not found');
            return;
        }
        
        // Find the submit button by various methods
        let submitBtn = container.querySelector('button[type="submit"]') || 
                       container.querySelector('.btn-primary') ||
                       Array.from(container.querySelectorAll('button')).find(btn => 
                           btn.textContent.includes('Send metaBoost') || 
                           btn.textContent.includes('metaBoost')
                       );
        
        if (!submitBtn) {
            console.log('❌ Submit button not found');
            return;
        }
        
        console.log('✅ Found submit button, adding click handler');
        
        // Remove any existing handlers and change to button type
        submitBtn.type = 'button';
        submitBtn.onclick = null;
        submitBtn.classList.add('metaboost-fixed-btn');
        
        // Add new click handler
        submitBtn.addEventListener('click', async function(event) {
            console.log('🚀 MetaBoost button clicked via fix script!');
            event.preventDefault();
            event.stopPropagation();
            
            try {
                // Get form data
                const amount = document.getElementById('payment-amount')?.value;
                const message = document.getElementById('payment-message')?.value;
                const paymentProof = document.getElementById('payment-proof')?.value;
                
                if (!amount || !paymentProof) {
                    alert('Please enter amount and payment proof');
                    return;
                }
                
                // Get selected recipients
                const recipientCheckboxes = document.querySelectorAll('#recipient-checkboxes input[type="checkbox"]:checked');
                const recipients = Array.from(recipientCheckboxes).map(cb => cb.value);
                
                if (recipients.length === 0) {
                    alert('Please select at least one recipient');
                    return;
                }
                
                // Show loading
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '📤 Sending...';
                submitBtn.disabled = true;
                
                // Prepare metaBoost data
                const metaBoostData = {
                    amount: parseInt(amount),
                    paymentProof: paymentProof,
                    message: message || '',
                    action: 'boost',
                    boostId: `boost_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    value_msat: parseInt(amount) * 1000,
                    value_msat_total: parseInt(amount) * 1000,
                    recipients: recipients,
                    podcast: window._lastPodcastTitle || 'Unknown Podcast',
                    episode: window._lastEpisodeTitle || 'Unknown Episode',
                    feedUrl: document.querySelector('input[type="url"]')?.value || '',
                    appName: 'V4V Lightning Payment Tester',
                    senderName: 'Anonymous Tester',
                    timestamp: new Date().toISOString(),
                    ts: Math.floor(Date.now() / 1000),
                    paymentInfo: {
                        type: 'lightning',
                        network: 'mainnet',
                        method: paymentProof.startsWith('lnbc') ? 'invoice' : 'keysend'
                    }
                };
                
                console.log('📤 Sending metaBoost:', metaBoostData);
                
                // Send to API
                const response = await fetch('/api/metaboost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(metaBoostData)
                });
                
                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('✅ MetaBoost sent successfully:', result);
                
                // Show success
                submitBtn.innerHTML = '✅ Sent Successfully!';
                
                // Create history section
                let historySection = document.getElementById('boost-history');
                if (!historySection) {
                    historySection = document.createElement('div');
                    historySection.id = 'boost-history';
                    historySection.innerHTML = '<h3 style="margin-top: 2rem; color: #0066cc;">📜 Recent MetaBoosts</h3>';
                    container.appendChild(historySection);
                }
                
                // Add boost entry
                const boostEntry = document.createElement('div');
                boostEntry.style.cssText = `
                    margin-top: 1rem;
                    padding: 1rem;
                    background: #2a2a2a;
                    border: 1px solid #00cc00;
                    border-radius: 8px;
                    color: white;
                `;
                
                boostEntry.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <h4 style="margin: 0; color: #00cc00;">✅ NEW ${amount} sats</h4>
                        <span style="color: #999; font-size: 0.9rem;">${new Date().toLocaleString()}</span>
                    </div>
                    <div><strong>Podcast:</strong> ${metaBoostData.podcast}</div>
                    <div><strong>Episode:</strong> ${metaBoostData.episode}</div>
                    ${message ? `<div><strong>Message:</strong> <em>"${message}"</em></div>` : ''}
                    <div><strong>Boost ID:</strong> <code>${metaBoostData.boostId}</code></div>
                    <div><strong>Recipients:</strong> ${recipients.join(', ')}</div>
                `;
                
                historySection.appendChild(boostEntry);
                
                // Reset button after delay
                setTimeout(() => {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }, 3000);
                
            } catch (error) {
                console.error('❌ MetaBoost Error:', error);
                submitBtn.innerHTML = `❌ Error: ${error.message}`;
                submitBtn.disabled = false;
                
                setTimeout(() => {
                    submitBtn.innerHTML = originalText || 'Send metaBoost Metadata';
                }, 3000);
            }
        });
        
        console.log('✅ MetaBoost fix handler attached successfully');
        
    }, 2000); // Wait 2 seconds for all other scripts to load
});