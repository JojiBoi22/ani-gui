#!/bin/bash

# Ensure we are in the script directory
cd "$(dirname "$0")"

echo "Rebuilding and starting ani-gui containers with volume mapping..."

# Stop any existing local processes to free up ports
pkill -f "node index.js" || true
pkill -f "vite" || true

# Stop existing containers if they exist
docker stop ani-server ani-client 2>/dev/null
docker rm ani-server ani-client 2>/dev/null

# Build Server
echo "Building Server..."
docker build -t ani-server ./server
# Run Server with volume mapping for live-sync (if needed) and logs
docker run -d --name ani-server \
  -p 3001:3001 \
  -v "$(pwd)/server:/app" \
  -v /app/node_modules \
  ani-server

# Build Client
echo "Building Client..."
docker build -t ani-client ./client
# Run Client with volume mapping
docker run -d --name ani-client \
  -p 5173:5173 \
  -v "$(pwd)/client:/app" \
  -v /app/node_modules \
  ani-client

echo "----------------------------------------"
echo "ani-gui is running in Docker with Live-Sync!"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001"
echo "----------------------------------------"
