// Test script for failed boost nodes
// Run this in the browser console to test the specific nodes that failed

console.log('🔍 Testing failed boost nodes...');

// The failed nodes from your boost results
const failedNodes = [
    '032870511bfa0309bab3ca1832ead69eed848a4abddbc4d50e55bb2157f9525e51',
    '03ecb3ee55ba6324d40bea174de096dc9134cb35d990235723b37ae9b5c49f4f53',
    '03ae9f91a0cb8ff43840e3c322c4c61f019d8c1c3cea15a25cfc425ac605e61a4a'
];

// Test each failed node
async function testFailedNodes() {
    console.log('=== Testing Failed Boost Nodes ===\n');
    
    for (let i = 0; i < failedNodes.length; i++) {
        const pubkey = failedNodes[i];
        console.log(`\n${i + 1}. Testing node: ${pubkey.substring(0, 16)}...`);
        
        try {
            // Test connectivity if the function exists
            if (typeof testNodeConnectivity === 'function') {
                const connectivity = await testNodeConnectivity(pubkey);
                console.log('Connectivity result:', connectivity);
                
                if (connectivity.reachable) {
                    console.log('✅ Node appears reachable - payment failure may be due to routing or wallet issues');
                } else {
                    console.log('❌ Node not reachable:', connectivity.message);
                }
            } else {
                console.log('⚠️ testNodeConnectivity function not available');
            }
            
            // Basic pubkey validation
            if (!/^[0-9a-fA-F]{66}$/.test(pubkey)) {
                console.log('❌ Invalid pubkey format');
            } else if (!['02', '03'].includes(pubkey.substring(0, 2))) {
                console.log('❌ Invalid pubkey prefix - expected 02 or 03');
            } else {
                console.log('✅ Pubkey format is valid');
            }
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }
    
    console.log('\n=== Test Complete ===');
    console.log('Check the results above to understand why these nodes failed.');
}

// Run the test
testFailedNodes();

// Also provide individual test functions
window.testSpecificNode = async function(pubkey) {
    if (!pubkey) {
        pubkey = prompt('Enter node pubkey to test:');
        if (!pubkey) return;
    }
    
    console.log(`\n🔍 Testing specific node: ${pubkey}`);
    
    try {
        if (typeof testNodeConnectivity === 'function') {
            const result = await testNodeConnectivity(pubkey);
            console.log('Connectivity test result:', result);
            
            let message = `Node: ${pubkey.substring(0, 16)}...\n`;
            message += `Status: ${result.reachable ? '✅ Reachable' : '❌ Not Reachable'}\n`;
            message += `Details: ${result.message}`;
            
            alert(message);
        } else {
            alert('testNodeConnectivity function not available');
        }
    } catch (error) {
        console.error('Test failed:', error);
        alert('Test failed: ' + error.message);
    }
};

console.log('✅ Test script loaded!');
console.log('Run testFailedNodes() to test all failed nodes');
console.log('Run testSpecificNode(pubkey) to test a specific node');
