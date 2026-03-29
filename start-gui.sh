#!/bin/bash

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(ss -tunlp | grep ":$port " | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2)
    if [ -n "$pid" ]; then
        echo "Killing process $pid on port $port..."
        kill -9 $pid 2>/dev/null
    fi
}

echo "Stopping existing services..."
kill_port 5173
kill_port 3001
pkill -f "node index.js" || true
pkill -f "vite" || true

echo "Starting Backend (Port 3001)..."
cd "$(dirname "$0")/server"
nohup node index.js > server.log 2>&1 &

echo "Starting Frontend (Port 5173)..."
cd "../client"
# Use --host to ensure it listens on all interfaces (useful for some Linux environments)
nohup npm run dev -- --port 5173 --strictPort --host > client.log 2>&1 &

echo "----------------------------------------"
echo "ani-gui is starting!"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001"
echo "----------------------------------------"
echo "Use 'tail -f ani-gui/client/client.log' to see frontend logs"
