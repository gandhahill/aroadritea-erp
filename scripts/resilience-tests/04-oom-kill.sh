#!/bin/bash
# ────────────────────────────────────────────────────────────────────────────
# Test 4: OOM Kill Simulation
# SD §35.2 Scenario 4: OOM kill via `docker kill -s KILL` → container
#   auto-restarts < 30 seconds (Docker `restart: unless-stopped` policy).
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.yml}"
SERVICE="web"
HEALTHZ_URL="http://localhost:3001/api/healthz"
MAX_WAIT=60  # seconds

echo "═══════════════════════════════════════════════════════════"
echo "  RESILIENCE TEST 4: OOM Kill Simulation"
echo "  SD §35.2 — Expected: auto-restart < 30s via Docker policy"
echo "═══════════════════════════════════════════════════════════"

# 1. Verify container is running
echo ""
echo "[1/4] Verifying $SERVICE is running..."
CONTAINER_ID=$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE" 2>/dev/null)
if [ -z "$CONTAINER_ID" ]; then
  echo "  ❌ FAIL: $SERVICE container not found."
  exit 1
fi
echo "  ✅ $SERVICE is running (ID: ${CONTAINER_ID:0:12})"

# 2. Verify health endpoint before kill
echo ""
echo "[2/4] Checking health endpoint pre-kill..."
if ! curl -sf "$HEALTHZ_URL" > /dev/null 2>&1; then
  echo "  ❌ FAIL: $HEALTHZ_URL is not responding"
  exit 1
fi
echo "  ✅ Health endpoint OK"

# 3. Send SIGKILL (simulates OOM kill)
echo ""
echo "[3/4] Sending SIGKILL to $SERVICE (simulating OOM kill)..."
KILL_TIME=$(date +%s)
docker kill -s KILL "$CONTAINER_ID"
echo "  ⏱ KILL sent at $(date)"
sleep 2  # brief wait for Docker to detect death

# 4. Wait for auto-restart
echo ""
echo "[4/4] Waiting for Docker to auto-restart $SERVICE..."

ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -sf "$HEALTHZ_URL" > /dev/null 2>&1; then
    RECOVERY_TIME=$(($(date +%s) - KILL_TIME))
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    if [ $RECOVERY_TIME -le 30 ]; then
      echo "  ✅ PASS: Auto-recovery time = ${RECOVERY_TIME}s (target: ≤ 30s)"
    elif [ $RECOVERY_TIME -le 120 ]; then
      echo "  ⚠ WARN: Auto-recovery time = ${RECOVERY_TIME}s (within RTO 120s)"
    else
      echo "  ❌ FAIL: Auto-recovery time = ${RECOVERY_TIME}s (exceeds RTO 120s)"
    fi
    echo "═══════════════════════════════════════════════════════════"

    # Verify it's a NEW container
    NEW_CONTAINER_ID=$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE" 2>/dev/null)
    if [ "$NEW_CONTAINER_ID" != "$CONTAINER_ID" ]; then
      echo "  ✅ New container spawned (ID: ${NEW_CONTAINER_ID:0:12})"
    else
      echo "  ⚠ Same container ID — may have been restarted in-place"
    fi
    exit 0
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  printf "\r  Waiting... %ds" $ELAPSED
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ❌ FAIL: $SERVICE did not auto-restart within ${MAX_WAIT}s"
echo "  Check: docker inspect restart policy for the container."
echo "═══════════════════════════════════════════════════════════"
exit 1
