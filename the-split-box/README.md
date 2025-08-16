# The Split Box - Keysend Proxy Server

A proxy server that allows wallets without keysend support to participate in value-for-value podcast payments. It accepts regular Lightning invoice payments and forwards them as keysend payments through your AlbyHub using Nostr Wallet Connect (NWC).

## How It Works

1. **Frontend requests proxy invoice** - When a wallet doesn't support keysend, the NWC Demo requests a proxy invoice from The Split Box
2. **Proxy creates invoice** - The Split Box creates an invoice via your AlbyHub NWC connection
3. **User pays invoice** - The user pays the invoice with their regular Lightning wallet
4. **Proxy forwards as keysend** - Once paid, The Split Box automatically forwards the payment as a keysend to the intended podcast recipient

## Setup

### 1. Prerequisites

- Node.js 16+ installed
- An AlbyHub instance with NWC access
- NWC connection string with these permissions:
  - `make_invoice` - To create invoices
  - `lookup_invoice` - To check payment status
  - `pay_keysend` - To forward payments
  - `get_balance` (optional) - For monitoring

### 2. Installation

```bash
# Clone the repo (if not already done)
git clone https://github.com/ChadFarrow/NWC-demo.git
cd NWC-demo/the-split-box

# Install dependencies
npm install
```

### 3. Configuration

Copy the example environment file and add your NWC connection string:

```bash
cp .env.example .env
```

Edit `.env` and add your AlbyHub NWC connection string:

```env
# Get this from your AlbyHub: Settings > Connections > Create New Connection
NWC_CONNECTION_STRING=nostr+walletconnect://your_wallet_pubkey?relay=wss://relay.getalby.com/v1&secret=your_secret_key

# Optional: Change the port (defaults to 3333)
PORT=3333

# Optional: Set CORS origin for production
CORS_ORIGIN=http://localhost:3003
```

### 4. Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3333` (or your configured port).

## API Endpoints

### `POST /api/createInvoice`

Create a proxy invoice that will be forwarded as keysend when paid.

**Request Body:**
```json
{
  "destination": "02abc123...",  // Node pubkey to send keysend to
  "amount": 1000,                // Amount in satoshis
  "message": "Optional message"   // Optional message for keysend
}
```

**Response:**
```json
{
  "success": true,
  "invoice": "lnbc...",           // Lightning invoice to pay
  "tracking_id": "abc123...",     // Tracking ID for status checks
  "expires_at": 1234567890000     // Expiry timestamp
}
```

### `GET /api/status/:trackingId`

Check the status of a proxy payment.

**Response:**
```json
{
  "tracking_id": "abc123...",
  "status": "pending|processing|completed|failed|expired",
  "amount": 1000,
  "created_at": 1234567890000,
  "completed_at": 1234567890000,  // If completed
  "payment_hash": "def456..."      // If completed
}
```

### `GET /api/info`

Get information about the proxy server configuration.

**Response:**
```json
{
  "configured": true,
  "relay": "wss://relay.getalby.com/v1",
  "pubkey": "02abc...",
  "supported_methods": ["pay_keysend", "make_invoice", "lookup_invoice"]
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "The Split Box",
  "nwc_configured": true,
  "active_invoices": 3,
  "uptime": 12345
}
```

## Integration with NWC Demo

The NWC Demo V4V Lightning Tester automatically uses The Split Box when:
1. The connected wallet doesn't support keysend
2. The Split Box proxy server is running and accessible

To enable proxy support in the NWC Demo:
1. Start The Split Box server on port 3333
2. The NWC Demo will automatically detect and use it for non-keysend wallets

## Architecture

```
┌─────────────┐     Invoice      ┌──────────────┐     NWC        ┌──────────┐
│   User's    │ ───Payment────▶  │  The Split   │ ───Commands──▶ │ AlbyHub  │
│   Wallet    │                   │     Box      │                 │          │
└─────────────┘                   └──────────────┘                 └──────────┘
                                          │                              │
                                          │         Keysend              ▼
                                          └────────Payment────────▶ [Podcast Node]
```

## Security Considerations

- **NWC Secret**: Keep your NWC connection string secret. Never commit it to version control.
- **CORS**: In production, set `CORS_ORIGIN` to your specific domain instead of allowing all origins.
- **HTTPS**: Use HTTPS in production to protect invoice data in transit.
- **Rate Limiting**: Consider adding rate limiting for production deployments.

## Troubleshooting

### NWC not configured
- Ensure your `.env` file contains a valid `NWC_CONNECTION_STRING`
- Check that your AlbyHub is running and accessible
- Verify the NWC connection has the required permissions

### Keysend failures
- Check that the destination pubkey is valid
- Ensure your AlbyHub has sufficient balance
- Verify the recipient node accepts keysend payments

### Invoice payment not detected
- The server polls every 2 seconds for payment status
- Invoices expire after 10 minutes
- Check the AlbyHub logs for payment receipts

## Development

The Split Box uses:
- Express.js for the HTTP server
- WebSocket for NWC communication
- secp256k1 for cryptographic operations
- Native crypto module for encryption

Key files:
- `server-v2.js` - Production-ready server implementation
- `nwc-client.js` - NWC protocol implementation
- `server.js` - Original development version

## License

Part of the NWC Demo project. See main repository for license details.