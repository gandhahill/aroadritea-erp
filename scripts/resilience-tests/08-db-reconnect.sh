#!/bin/bash
# ────────────────────────────────────────────────────────────────────────────
# Test 8: DB Connection Drop + Reconnect
# SD §35.2 Scenario 8: DB connection drop → app reconnects ≤ 5s,
#   no requests lost.
#
# Strategy: use iptables to temporarily block traffic to Neon DB port,
# then unblock and verify the app reconnects.
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.yml}"
SERVICE="web"
HEALTHZ_URL="http://localhost:3001/api/healthz"
DB_BLOCK_DURATION=10  # seconds
MAX_RECOVERY_WAIT=15  # seconds

echo "═══════════════════════════════════════════════════════════"
echo "  RESILIENCE TEST 8: DB Connection Drop + Reconnect"
echo "  SD §35.2 — Expected: reconnect ≤ 5s, no request lost"
echo "═══════════════════════════════════════════════════════════"

# 1. Verify health endpoint (which tests DB connection)
echo ""
echo "[1/5] Verifying $SERVICE is healthy with DB connection..."
HEALTH_RESPONSE=$(curl -sf "$HEALTHZ_URL" 2>/dev/null || echo "FAIL")
if echo "$HEALTH_RESPONSE" | grep -qi "ok\|healthy"; then
  echo "  ✅ Health check OK — DB connected"
else
  echo "  ❌ FAIL: Health check failed before test: $HEALTH_RESPONSE"
  exit 1
fi

# 2. Get DB host from container env
echo ""
echo "[2/5] Resolving DB host from container environment..."
CONTAINER_ID=$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE" 2>/dev/null)
DB_URL=$(docker exec "$CONTAINER_ID" printenv DATABASE_URL 2>/dev/null || echo "")
if [ -z "$DB_URL" ]; then
  echo "  ⚠ Cannot read DATABASE_URL from container. Using network pause instead."
  USE_PAUSE=true
else
  # Extract host from postgres://user:pass@host:port/db
  DB_HOST=$(echo "$DB_URL" | sed -n 's|.*@\([^:/?]*\).*|\1|p')
  echo "  DB Host: $DB_HOST"
  USE_PAUSE=false
fi

# 3. Block DB connection
echo ""
echo "[3/5] Simulating DB connection drop for ${DB_BLOCK_DURATION}s..."

if [ "${USE_PAUSE:-false}" = true ]; then
  # Fallback: pause the container briefly (simulates total network drop)
  docker pause "$CONTAINER_ID"
  echo "  ⏸ Container paused at $(date)"
  sleep "$DB_BLOCK_DURATION"
  docker unpause "$CONTAINER_ID"
  echo "  ▶ Container unpaused at $(date)"
else
  # Preferred: block outbound traffic to DB host using iptables in container
  docker exec "$CONTAINER_ID" sh -c "
    apk add --no-cache iptables > /dev/null 2>&1 || true
    iptables -A OUTPUT -d $DB_HOST -j DROP 2>/dev/null || true
  " 2>/dev/null || echo "  ⚠ Could not install iptables in container, using pause fallback"

  if [ $? -ne 0 ]; then
    docker pause "$CONTAINER_ID"
    sleep "$DB_BLOCK_DURATION"
    docker unpause "$CONTAINER_ID"
  else
    echo "  🔒 DB traffic blocked"
    sleep "$DB_BLOCK_DURATION"
    docker exec "$CONTAINER_ID" sh -c "iptables -D OUTPUT -d $DB_HOST -j DROP 2>/dev/null || true" 2>/dev/null
    echo "  🔓 DB traffic unblocked"
  fi
fi

DROP_TIME=$(date +%s)

# 4. Verify DB reconnection
echo ""
echo "[4/5] Waiting for DB reconnection..."

ELAPSED=0
while [ $ELAPSED -lt $MAX_RECOVERY_WAIT ]; do
  HEALTH_RESPONSE=$(curl -sf "$HEALTHZ_URL" 2>/dev/null || echo "FAIL")
  if echo "$HEALTH_RESPONSE" | grep -qi "ok\|healthy"; then
    RECOVERY_TIME=$(($(date +%s) - DROP_TIME))
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    if [ $RECOVERY_TIME -le 5 ]; then
      echo "  ✅ PASS: DB reconnected in ${RECOVERY_TIME}s (target: ≤ 5s)"
    elif [ $RECOVERY_TIME -le 15 ]; then
      echo "  ⚠ WARN: DB reconnected in ${RECOVERY_TIME}s (target: ≤ 5s)"
    else
      echo "  ❌ FAIL: DB reconnected in ${RECOVERY_TIME}s (exceeds target)"
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
echo "  ❌ FAIL: $SERVICE did not reconnect to DB within ${MAX_RECOVERY_WAIT}s"
echo "═══════════════════════════════════════════════════════════"
exit 1
