# V4V Lightning Payment Tester

A tool for testing Lightning Network payments and podcast value splits with **PodPay integration**.

## 🚀 New: PodPay Integration

This project now includes a local implementation of the `@fountain/podpay` library functionality, providing enhanced Podcasting 2.0 payment handling:

- **Enhanced Value Block Parsing**: Better parsing of podcast value blocks using PodPay
- **Smart Payment Splits**: Automatic calculation of payment splits based on recipient configuration
- **metaBoost Generation**: Generate proper metaBoost metadata for V4V payments
- **Validation Tools**: Lightning address and node pubkey validation
- **Utility Functions**: Sats/BTC conversion and formatting helpers

### PodPay Features

- Parse RSS feeds with enhanced value block detection
- Calculate payment splits automatically
- Generate metaBoost metadata for payment tracking
- Validate Lightning addresses and node pubkeys
- Support for multiple recipient types and split methods

## Feed URL
https://raw.githubusercontent.com/ChadFarrow/lnurl-test-feed/main/feed.xml

## Episodes
- LNURL Testing Episode

## Testing
This feed is designed for testing LNURL payments in podcast apps. Each episode has value blocks that support Lightning payments.

## Value Blocks
The feed includes value blocks with the following recipients:

### Lightning Addresses
- chadf@getalby.com
- chadf@btcpay.podtards.com
- eagerheron90@zeusnuts.com
- cobaltfly1@primal.net

### Node Pubkeys (Keysend)
- 032870511bfa0309bab3ca1832ead69eed848a4abddbc4d50e55bb2157f9525e51

## Setup
1. Clone this repository
2. Customize the `config` object in `customize-feed.js`
3. Run `node customize-feed.js` to generate updated feed
4. Commit and push changes

## Testing Apps
- **Fountain**: Add feed URL to test Lightning payments
- **Breez**: Test LNURL integration
- **Podverse**: Check value block parsing
- **Castamatic**: Test Lightning address support

## Customization
Edit the `config` object in `customize-feed.js` to:
- Change Lightning addresses
- Add/remove node pubkeys
- Modify episode content
- Update personal information

Then run `node customize-feed.js` to regenerate the feed.

## PodPay Usage

### Basic Usage
```javascript
// Parse value blocks with PodPay
await parseValueBlocksWithPodPay();

// Calculate payment splits
calculateSplitsWithPodPay();

// Generate metaBoost metadata
generateMetaBoostWithPodPay();

// Test library functionality
testPodPayLibrary();
```

### Advanced Features
- **Automatic Split Calculation**: PodPay automatically calculates payment amounts based on recipient splits
- **metaBoost Generation**: Creates proper metadata for payment tracking
- **Validation**: Ensures Lightning addresses and node pubkeys are properly formatted
- **Utility Functions**: Easy conversion between sats and BTC

---

## Useful Podcasting 2.0 & V4V Ecosystem Links

- [@fountain/podpay (JSR)](https://jsr.io/@fountain/podpay) — JavaScript/TypeScript library for Podcasting 2.0 payments and splits *(Note: Currently implemented locally)*
- [Podcastindex-org/podcast-namespace Discussion #676: <podcast:metaBoost> proposal](https://github.com/Podcastindex-org/podcast-namespace/discussions/676) — Proposal for a new tag and API for boost/metadata
- [thebells1111/thesplitbox](https://github.com/thebells1111/thesplitbox) — Open-source value split and boostagram processor
- [podtoo/boostagramLIVE](https://github.com/podtoo/boostagramLIVE) — Real-time boostagram display and integration
