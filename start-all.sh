#!/bin/bash

# NWC Demo - Complete Startup Script
# This script starts all required services and configures webhooks

echo "🚀 Starting NWC Demo..."

# Kill any existing processes
echo "📍 Cleaning up existing processes..."
pkill -f "ngrok http 4000" 2>/dev/null
pkill -f "node server/index.js" 2>/dev/null
pkill -f "node proxy.js" 2>/dev/null
pkill -f "vite dev" 2>/dev/null
sleep 2

# Start ngrok tunnel
echo "🌐 Starting ngrok tunnel..."
cd /Users/chad-mini/Vibe/V4V\ Lightning\ Payment\ Tester
ngrok http 4000 > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
sleep 5

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    exit 1
fi
echo "✅ Ngrok URL: $NGROK_URL"

# Start backend server
echo "🖥️  Starting backend server..."
cd /Users/chad-mini/Vibe/V4V\ Lightning\ Payment\ Tester/thesplitbox
node server/index.js &
BACKEND_PID=$!
sleep 3

# Register webhook with Alby
echo "🔗 Registering webhook with Alby..."
WEBHOOK_RESPONSE=$(curl -X POST https://api.getalby.com/webhook/nwc \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'$NGROK_URL'/webhook",
    "description": "V4V Payment Tester",
    "events": ["payment_received", "payment_sent"]
  }')
echo "✅ Webhook registered"

# Start proxy server
echo "🔀 Starting proxy server..."
node proxy.js &
PROXY_PID=$!
sleep 2

# Start frontend
echo "🎨 Starting frontend..."
cd client
npm run dev &
FRONTEND_PID=$!
sleep 3

# Save PIDs for cleanup
echo "NGROK_PID=$NGROK_PID" > /tmp/v4v-pids.txt
echo "BACKEND_PID=$BACKEND_PID" >> /tmp/v4v-pids.txt
echo "PROXY_PID=$PROXY_PID" >> /tmp/v4v-pids.txt
echo "FRONTEND_PID=$FRONTEND_PID" >> /tmp/v4v-pids.txt

echo "
✅ All services started successfully!

📍 Service URLs:
- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Proxy: http://localhost:3001
- Ngrok: $NGROK_URL

🔄 Webhook: $NGROK_URL/webhook

To stop all services, run: ./stop-all.sh
"

# Keep script running
wait