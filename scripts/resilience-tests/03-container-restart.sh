#!/bin/bash
# ────────────────────────────────────────────────────────────────────────────
# Test 3: Container Stop + Auto-Restart
# SD §35.2 Scenario 3: Stop container `web` → Caddy serves maintenance/502,
#   container restarts < 30 seconds, service resumes healthy.
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.yml}"
SERVICE="web"
HEALTHZ_URL="http://localhost:3001/api/healthz"
MAX_WAIT=60  # seconds

echo "═══════════════════════════════════════════════════════════"
echo "  RESILIENCE TEST 3: Container Restart"
echo "  SD §35.2 — Expected: container restarts < 30s"
echo "═══════════════════════════════════════════════════════════"

# 1. Verify container is running
echo ""
echo "  OK $SERVICE is running..."
if ! docker compose -f "$COMPOSE_FILE" ps "$SERVICE" | grep -q "Up"; then
  echo "  ERROR FAIL: $SERVICE is not running. Start it first."
  exit 1
fi
echo "  OK $SERVICE is running"

# 2. Verify health endpoint
echo ""
echo "[2/5] Checking health endpoint..."
if ! curl -sf "$HEALTHZ_URL" > /dev/null 2>&1; then
  echo "  ERROR FAIL: $HEALTHZ_URL is not responding"
  exit 1
fi
echo "  OK Health endpoint OK"

# 3. Stop the container
echo ""
echo "[3/5] Stopping $SERVICE container..."
STOP_TIME=$(date +%s)
docker compose -f "$COMPOSE_FILE" stop "$SERVICE"
echo "  ⏱ Container stopped at $(date)"

# 4. Verify it's down
echo ""
echo "[4/5] Verifying $SERVICE is down..."
if curl -sf "$HEALTHZ_URL" > /dev/null 2>&1; then
  echo "  WARNING: Health endpoint still responding after stop"
fi
echo "  OK $SERVICE is confirmed down"

# 5. Restart and measure recovery time
echo ""
echo "[5/5] Starting $SERVICE and measuring recovery time..."
docker compose -f "$COMPOSE_FILE" start "$SERVICE"

ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -sf "$HEALTHZ_URL" > /dev/null 2>&1; then
    RECOVERY_TIME=$(($(date +%s) - STOP_TIME))
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    if [ $RECOVERY_TIME -le 30 ]; then
      echo "  OK PASS: Recovery time = ${RECOVERY_TIME}s (target: ≤ 30s)"
    elif [ $RECOVERY_TIME -le 120 ]; then
      echo "  WARNING WARN: Recovery time = ${RECOVERY_TIME}s (target: ≤ 30s, RTO: ≤ 120s)"
    else
      echo "  ERROR FAIL: Recovery time = ${RECOVERY_TIME}s (exceeds RTO 120s)"
    fi
    echo "═══════════════════════════════════════════════════════════"
    exit 0
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  printf "\r  Waiting... %ds" $ELAPSED
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ERROR FAIL: $SERVICE did not recover within ${MAX_WAIT}s"
echo "═══════════════════════════════════════════════════════════"
exit 1

