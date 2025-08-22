// Minimal NWC test to create an invoice
require('dotenv').config({ path: './the-split-box/.env' });
const NWCClient = require('./the-split-box/nwc-client');

async function testNWC() {
    try {
        console.log('🧪 Testing minimal NWC invoice creation...');
        
        const client = new NWCClient(process.env.NWC_CONNECTION_STRING);
        console.log('✅ NWC client created');
        console.log('📡 Relay:', client.relay);
        
        // Create a simple 1 sat invoice
        console.log('🔄 Creating 1 sat invoice...');
        const invoice = await client.makeInvoice(1, 'Test Split Box Invoice');
        
        console.log('✅ SUCCESS! Invoice created:', invoice.substring(0, 50) + '...');
        console.log('🎉 The Split Box proxy will work!');
        
    } catch (error) {
        console.error('❌ NWC test failed:', error.message);
        console.log('\n🔍 Debug info:');
        console.log('- Check AlbyHub is running');
        console.log('- Check NWC connection has make_invoice permission');
        console.log('- Check relay connectivity');
    }
}

testNWC();