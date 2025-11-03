#!/bin/bash

# Start local server and show access URL for deeplink testing
PORT=8000

# Kill any existing server on this port
pkill -f "python3 -m http.server $PORT" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "🛑 Stopped existing server on port $PORT"
  sleep 1
fi

# Get local IP address (works on macOS)
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I | awk '{print $1}')

# If no IP found, use localhost
if [ -z "$IP" ]; then
  IP="localhost"
fi

echo "🌐 Starting local server on port $PORT"
echo "📱 Access deeplink tester at:"
echo "   http://$IP:$PORT/deeplink.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
python3 -m http.server $PORT

