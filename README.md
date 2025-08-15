# NWC Demo

A comprehensive demo environment showcasing Nostr Wallet Connect (NWC) integration with Lightning Network payments, including metaBoost functionality and payment testing capabilities.

## 🚀 Features

### Core Functionality
- **Lightning Payment Testing** - Test various Lightning payment methods
- **MetaBoost Integration** - Send and receive metaBoosts with payment proofs
- **NWC Support** - Full Nostr Wallet Connect integration for real payments
- **RSS Feed Parsing** - Parse podcast feeds to extract value blocks
- **Payment Proof Generation** - Generate cryptographic proof of payments

### Payment Methods
- **Keysend Payments** - Direct node-to-node payments
- **Invoice Payments** - Standard Lightning invoice payments
- **HODL Invoices** - Time-locked payments with preimage control

## 🛠️ Setup

### Prerequisites
- Node.js (v16 or higher)
- A Lightning node with NWC support
- Nostr Wallet Connect compatible wallet

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `npm start`

### Environment Setup
- Configure your NWC connection string
- Set up your Lightning node
- Configure relay endpoints

## 📱 Usage

### 1. Connect Your Wallet
1. Open `v4v_lightning_tester.html`
2. Enter your NWC connection string
3. Click "Connect Wallet" to verify connection

### 2. Parse RSS Feeds
1. Enter an RSS feed URL containing value blocks
2. Click "Parse Value Block" to extract recipients
3. Select recipients from the parsed results

### 3. Send Payments
1. Enter payment amount and message
2. Select recipients from parsed value blocks
3. Click "Send Normal Boost" to execute payment
4. Payment proof is automatically generated and submitted

### 4. View MetaBoosts
- Visit `/api/metaboost-viewer` to see all received boosts
- Use `/public/test-metaboost.html` for testing metaBoost submission

## 🔧 API Endpoints

### MetaBoost API
- `POST /api/metaboost` - Submit a new metaBoost
- `GET /api/metaboost-viewer` - View metaBoost interface
- `POST /api/metaboost-viewer` - Manage metaBoost data

### NWC Integration
- Full Nostr Wallet Connect protocol support
- Encrypted communication with Lightning wallets
- Real-time payment status updates

## 📊 MetaBoost Specification

Each metaBoost includes:
- **Amount** - Payment amount in sats
- **Payment Proof** - Cryptographic proof of payment
- **Message** - User message or comment
- **Recipients** - Array of payment destinations
- **Feed URL** - Source podcast RSS feed
- **Episode GUID** - Unique episode identifier
- **Timestamp** - Payment timestamp
- **App Name** - Sending application identifier
- **Sender Name** - User identifier

### Payment Proof Format
```json
{
  "type": "keysend",
  "destination": "node_pubkey",
  "amount_msat": 100000,
  "amount_sats": 100,
  "message": "User message",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "payment_hash": "payment_hash_hex",
  "preimage": "preimage_hex",
  "success": true
}
```

## 🧪 Testing

### Test Pages
- **Main Tester**: `v4v_lightning_tester.html` - Full payment testing interface
- **MetaBoost Test**: `public/test-metaboost.html` - MetaBoost submission testing
- **Viewer**: `/api/metaboost-viewer` - MetaBoost display interface

### Test Scenarios
1. **Connection Test** - Verify NWC wallet connection
2. **Keysend Test** - Test minimal payment (1 sat)
3. **MetaBoost Test** - Submit test metaBoost with payment proof
4. **RSS Parsing** - Parse test feeds for value blocks

## 🔒 Security Features

- **Encrypted Communication** - All NWC traffic is encrypted
- **Payment Verification** - Cryptographic proof of payment completion
- **Input Validation** - Comprehensive validation of all inputs
- **Error Handling** - Graceful error handling and user feedback

## 🚨 Troubleshooting

### Common Issues
1. **NWC Connection Failed**
   - Verify connection string format
   - Check wallet compatibility
   - Ensure relay is accessible

2. **Payment Failed**
   - Verify sufficient balance
   - Check destination node connectivity
   - Review payment amount limits

3. **MetaBoost Submission Error**
   - Verify API endpoint accessibility
   - Check payment proof format
   - Ensure all required fields are present

### Debug Tools
- **Debug NWC** - Test wallet connection and balance
- **Test Keysend** - Verify payment functionality
- **Console Logging** - Detailed operation logging

## 📈 Future Enhancements

- [ ] Multi-recipient payment splitting
- [ ] Advanced payment proof verification
- [ ] Batch metaBoost processing
- [ ] Payment analytics and reporting
- [ ] Integration with podcast platforms

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Lightning Network community
- Nostr Wallet Connect developers
- MetaBoost specification contributors
- Value for Value podcasting community
