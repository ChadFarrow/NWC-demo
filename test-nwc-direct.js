// Direct NWC test to debug the connection
const WebSocket = require('ws');

console.log('🧪 Testing direct WebSocket connection to Alby relay...');

const relay = 'wss://relay.getalby.com/v1';
const ws = new WebSocket(relay);

ws.on('open', () => {
    console.log('✅ WebSocket connected to:', relay);
    
    // Send a simple subscription request
    const subscription = JSON.stringify([
        'REQ',
        'test-sub',
        {
            kinds: [1],
            limit: 1
        }
    ]);
    
    console.log('📤 Sending test subscription...');
    ws.send(subscription);
    
    // Close after 5 seconds
    setTimeout(() => {
        console.log('🔚 Closing connection');
        ws.close();
        process.exit(0);
    }, 5000);
});

ws.on('message', (data) => {
    console.log('📥 Received message:', data.toString());
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('🔚 WebSocket closed');
});

// Timeout after 10 seconds
setTimeout(() => {
    console.error('❌ Connection timeout after 10 seconds');
    process.exit(1);
}, 10000);