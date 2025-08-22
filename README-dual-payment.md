# Dual Payment Methods Branch

This branch implements a smart payment routing system that eliminates the need for The Split Box (TSB) proxy by supporting both keysend and Lightning address payment methods for the same recipient.

## What's New

### 🔧 Smart Payment Routing
- **Wallet Detection**: Automatically detects if your NWC wallet supports keysend
- **Optimal Payment Method**: Uses keysend when available, falls back to Lightning addresses when needed
- **No Proxy Required**: Eliminates TSB dependency while maintaining universal wallet compatibility

### 📊 Enhanced RSS Feed Support
The app now parses RSS feeds that include dual payment methods:

```xml
<!-- Same recipient, two payment options -->
<podcast:valueRecipient name="Alice Host" type="node" 
  address="02eec..." split="45" />
<podcast:valueRecipient name="Alice Host" type="lnaddress" 
  address="alice@getalby.com" split="45" />
```

### 💰 Wallet Compatibility

**Keysend-Capable Wallets (Preferred Path):**
- ✅ Alby Hub - Uses direct keysend
- ✅ LND-based wallets - Uses direct keysend

**Non-Keysend Wallets (Fallback Path):**
- ✅ Primal - Uses Lightning address fallbacks
- ✅ Coinos - Uses Lightning address fallbacks

## Files Changed

- `public/v4v_lightning_tester.html` - Updated UI and payment processing
- `public/test-feed.xml` - Example dual payment RSS feed
- `public/dual-payment-example.js` - Smart payment routing logic
- `dual-payment-feed-examples.xml` - Additional RSS examples

## How It Works

1. **RSS Parsing**: Extracts both keysend pubkeys and Lightning addresses for each recipient
2. **Wallet Analysis**: Detects wallet capabilities via NIP-47 `get_info` command
3. **Smart Routing**: Chooses optimal payment method per recipient:
   - Keysend if wallet supports it AND recipient has pubkey
   - Lightning address if wallet doesn't support keysend OR no pubkey available
4. **Payment Execution**: Processes all payments with detailed success/failure reporting

## Benefits

- 🚀 **No TSB Dependency** - Cleaner architecture, fewer moving parts
- 🌍 **Universal Compatibility** - Works with any NWC wallet
- ⚡ **Performance Optimized** - Keysend when possible, fallback when needed
- 📝 **Standards Compliant** - Uses existing Podcastindex RSS specification
- 🎯 **Podcaster Control** - Creators choose which recipients get fallback options

## Testing

Load the enhanced test feed to see dual payment methods in action:
- Channel-level recipients with both keysend and Lightning address options
- Episode-level value blocks with guest payments
- Mixed payment methods (some recipients keysend-only, others Lightning address-only)

## For Podcasters

To implement dual payment methods in your RSS feed:

1. **Provide both payment methods** for the same recipient (same name + split)
2. **Keysend recipients** get `type="node"` with 66-character pubkey
3. **Lightning address recipients** get `type="lnaddress"` with email-style address
4. **Wallets will automatically** choose the best payment method

This approach gives you maximum compatibility while preserving the performance benefits of keysend for capable wallets.