// Load nostr-tools from CDN and expose to window
// Try multiple CDN sources to ensure availability
const nostrToolsSources = [
    'https://cdn.jsdelivr.net/npm/nostr-tools@2.15.0/lib/nostr.bundle.js',
    'https://unpkg.com/nostr-tools@2.15.0/lib/nostr.bundle.js',
    'https://cdn.skypack.dev/nostr-tools@2.15.0'
];

let currentSourceIndex = 0;

function tryLoadNostrTools() {
    if (currentSourceIndex >= nostrToolsSources.length) {
        console.error('All nostr-tools CDN sources failed');
        createNostrToolsStub();
        return;
    }
    
    const script = document.createElement('script');
    script.src = nostrToolsSources[currentSourceIndex];
    
    script.onload = function() {
        console.log(`nostr-tools loaded from ${nostrToolsSources[currentSourceIndex]}`);
        
        // Check if it's available on window.nostr or window.NostrTools
        if (window.nostr) {
            setupNostrTools(window.nostr);
        } else if (window.NostrTools) {
            setupNostrTools(window.NostrTools);
        } else {
            // Try to find it in the global scope
            const globalNostr = window.nostr_tools_exports || window.nostrTools;
            if (globalNostr) {
                setupNostrTools(globalNostr);
            } else {
                console.error('nostr-tools loaded but not found in global scope');
                currentSourceIndex++;
                tryLoadNostrTools();
            }
        }
    };
    
    script.onerror = function() {
        console.error(`Failed to load nostr-tools from ${nostrToolsSources[currentSourceIndex]}`);
        currentSourceIndex++;
        tryLoadNostrTools();
    };
    
    document.head.appendChild(script);
}

function setupNostrTools(nostrModule) {
    // Expose individual functions for backward compatibility
    window.nip04 = nostrModule.nip04;
    window.getPublicKey = nostrModule.getPublicKey;
    window.getEventHash = nostrModule.getEventHash;
    window.finalizeEvent = nostrModule.finalizeEvent;
    
    // Expose the full nostr-tools object as expected by script.js
    window.nostrTools = {
        nip04: nostrModule.nip04,
        getPublicKey: nostrModule.getPublicKey,
        getEventHash: nostrModule.getEventHash,
        finalizeEvent: nostrModule.finalizeEvent,
        // Add any other functions that might be needed
        ...nostrModule
    };
    
    console.log('nostr-tools functions exposed to window:', Object.keys(window.nostrTools));
    
    // Signal that nostr-tools is ready
    window.dispatchEvent(new CustomEvent('nostrToolsReady'));
}

function createNostrToolsStub() {
    console.warn('Creating nostr-tools stub - NWC functionality will not work');
    
    window.nostrTools = {
        nip04: {
            encrypt: () => Promise.reject(new Error('nostr-tools not loaded')),
            decrypt: () => Promise.reject(new Error('nostr-tools not loaded'))
        },
        getPublicKey: () => Promise.reject(new Error('nostr-tools not loaded')),
        getEventHash: () => 'stub',
        finalizeEvent: () => ({ id: 'stub', sig: 'stub' })
    };
    
    // Signal ready even though it's a stub
    window.dispatchEvent(new CustomEvent('nostrToolsReady'));
}

// Start loading nostr-tools
tryLoadNostrTools(); 

// ===== MetaBoost Form Handler =====
console.log('🔄 [main.js] Setting up metaBoost form handler...');

function setupMetaBoostFormHandler() {
    const metaBoostForm = document.getElementById('real-payment-form');
    if (metaBoostForm) {
        console.log('✅ [main.js] Found metaBoost form, adding event listener');
        
        // Remove any existing listeners
        metaBoostForm.onsubmit = null;
        
        // Add new event listener with explicit prevention
        metaBoostForm.addEventListener('submit', function(event) {
            console.log('🚀 [main.js] Form submit event triggered!');
            event.preventDefault();
            event.stopPropagation();
            
            // Call the function from script.js
            if (typeof window.sendMetaBoostMetadata === 'function') {
                console.log('📤 [main.js] Calling sendMetaBoostMetadata...');
                window.sendMetaBoostMetadata(event);
            } else {
                console.error('❌ [main.js] sendMetaBoostMetadata function not found!');
            }
            
            return false;
        }, true); // Use capture phase
        
        console.log('✅ [main.js] Form handler setup complete');
    } else {
        console.log('⏳ [main.js] Form not found yet, trying again in 200ms...');
        setTimeout(setupMetaBoostFormHandler, 200);
    }
}

// Setup form handler after a delay to ensure all scripts are loaded
setTimeout(() => {
    console.log('🎯 [main.js] Starting delayed form handler setup...');
    setupMetaBoostFormHandler();
}, 500); 