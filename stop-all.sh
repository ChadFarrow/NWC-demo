#!/bin/bash

# NWC Demo - Stop Script

echo "🛑 Stopping NWC Demo..."

# Read PIDs if available
if [ -f /tmp/v4v-pids.txt ]; then
    source /tmp/v4v-pids.txt
    kill $NGROK_PID $BACKEND_PID $PROXY_PID $FRONTEND_PID 2>/dev/null
fi

# Kill by process name as backup
pkill -f "ngrok http 4000"
pkill -f "node server/index.js"
pkill -f "node proxy.js"
pkill -f "vite dev"

# Clean up
rm -f /tmp/v4v-pids.txt
rm -f /tmp/ngrok.log

echo "✅ All services stopped"