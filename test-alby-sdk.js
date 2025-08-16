// Test using official Alby SDK
require('websocket-polyfill');
require('dotenv').config({ path: './the-split-box/.env' });

async function testAlbySDK() {
    try {
        const sdk = await import('@getalby/sdk');
        console.log('📦 SDK imported:', Object.keys(sdk));
        
        console.log('🧪 Testing with official Alby SDK...');
        
        const nwc = new sdk.NostrWebLNProvider({
            nostrWalletConnectUrl: process.env.NWC_CONNECTION_STRING
        });
        
        console.log('🔄 Enabling NWC connection...');
        await nwc.enable();
        
        console.log('✅ Connected! Testing getInfo...');
        const info = await nwc.getInfo();
        console.log('📋 Wallet info:', info);
        
        console.log('🔄 Testing makeInvoice...');
        const invoice = await nwc.makeInvoice({
            amount: 1000, // 1 sat in millisats
            defaultDescription: 'Test invoice from Alby SDK'
        });
        
        console.log('✅ Invoice created:', invoice.paymentRequest.substring(0, 50) + '...');
        
        nwc.close();
        console.log('🎉 Alby SDK test successful!');
        
    } catch (error) {
        console.error('❌ Alby SDK test failed:', error.message);
        console.log('Error details:', error);
    }
}

testAlbySDK();