#!/bin/bash

# Run Playwright E2E tests with automatic Tauri dev server management

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DEV_SERVER_PORT=1420

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== SSH Vault E2E Test Runner${NC}"

# Check if dev server is already running
if lsof -Pi :$DEV_SERVER_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Dev server already running on port $DEV_SERVER_PORT${NC}"
  SERVER_PID=""
else
  echo "Starting Tauri dev server..."
  cd "$PROJECT_ROOT"
  npm run dev > /tmp/tauri-dev.log 2>&1 &
  SERVER_PID=$!

  # Wait for server to be ready
  echo -n "Waiting for server"
  for i in {1..30}; do
    if curl -s "http://localhost:$DEV_SERVER_PORT" > /dev/null 2>&1; then
      echo -e "\n${GREEN}✓ Dev server ready${NC}"
      break
    fi
    echo -n "."
    sleep 1
  done

  if ! curl -s "http://localhost:$DEV_SERVER_PORT" > /dev/null 2>&1; then
    echo -e "\n${RED}✗ Dev server failed to start${NC}"
    cat /tmp/tauri-dev.log
    exit 1
  fi
fi

# Run tests
echo -e "${YELLOW}Running E2E tests...${NC}"
cd "$PROJECT_ROOT"
npx playwright test "$@"
TEST_RESULT=$?

# Cleanup
if [ -n "$SERVER_PID" ]; then
  echo "Stopping dev server (PID: $SERVER_PID)"
  kill $SERVER_PID 2>/dev/null || true
fi

exit $TEST_RESULT
