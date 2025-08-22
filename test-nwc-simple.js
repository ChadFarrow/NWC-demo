// Simple NWC test using your exact connection string
require('dotenv').config({ path: './the-split-box/.env' });

const connectionString = process.env.NWC_CONNECTION_STRING;

console.log('🧪 Testing NWC connection...');
console.log('Connection string:', connectionString ? 'Found' : 'Missing');

if (!connectionString) {
    console.error('❌ No NWC_CONNECTION_STRING found in .env');
    process.exit(1);
}

// Parse the connection string
const url = new URL(connectionString.replace('nostr+walletconnect://', 'https://'));
const walletPubkey = url.hostname;
const params = new URLSearchParams(url.search);
const relay = params.get('relay')?.replace(/%2F/g, '/').replace(/%3A/g, ':');
const secret = params.get('secret');

console.log('✅ Parsed connection:');
console.log('  Wallet pubkey:', walletPubkey.substring(0, 16) + '...');
console.log('  Relay:', relay);
console.log('  Secret:', secret ? 'Present' : 'Missing');

// Try to connect to the relay
const WebSocket = require('ws');
console.log('\n🔌 Connecting to relay:', relay);

const ws = new WebSocket(relay);

ws.on('open', () => {
    console.log('✅ Connected to relay');
    
    // Try a basic subscription to see if we get a response
    const sub = JSON.stringify([
        'REQ', 
        'test-123',
        {
            authors: [walletPubkey],
            kinds: [23195], // NWC response events
            limit: 1
        }
    ]);
    
    console.log('📤 Sending test subscription for wallet events...');
    ws.send(sub);
    
    setTimeout(() => {
        console.log('🔚 Test complete');
        ws.close();
        process.exit(0);
    }, 5000);
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', message[0]);
    
    if (message[0] === 'EOSE') {
        console.log('✅ Subscription complete - relay is responding');
    } else if (message[0] === 'EVENT') {
        console.log('✅ Found wallet event - NWC should work');
    } else if (message[0] === 'CLOSED') {
        console.log('❌ Subscription closed:', message[2]);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('❌ Test timeout - no response from relay');
    process.exit(1);
}, 10000);