#!/bin/bash
# ────────────────────────────────────────────────────────────────────────────
# Test 7: Server Down Notification
# SD §35.2 Scenario 7: Server down 5 minutes → notification sent to admin
#
# NOTE: This test verifies the healthcheck monitoring loop in the worker
# detects a downed service and logs the alert. Actual WA/email delivery
# depends on webhook configuration.
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.yml}"
SERVICE="web"
HEALTHZ_URL="http://localhost:3001/api/healthz"

echo "═══════════════════════════════════════════════════════════"
echo "  RESILIENCE TEST 7: Server Down Notification"
echo "  SD §35.2 — Expected: admin gets notified within 5 min"
echo "═══════════════════════════════════════════════════════════"

# 1. Verify all services are running
echo ""
echo "[1/4] Verifying all services are running..."
docker compose -f "$COMPOSE_FILE" ps
echo ""

# 2. Stop the target service
echo "[2/4] Stopping $SERVICE to simulate outage..."
docker compose -f "$COMPOSE_FILE" stop "$SERVICE"
echo "  ⏱ $SERVICE stopped at $(date)"

# 3. Wait and check worker logs for alert detection
echo ""
echo "[3/4] Monitoring worker logs for health check failure detection..."
echo "  (Worker health monitor runs every 5 minutes per SD §35.1.5)"
echo "  Watching for 60 seconds of logs..."

# Follow worker logs for up to 60s looking for health failure detection
timeout 60 docker compose -f "$COMPOSE_FILE" logs --follow --tail=0 worker 2>&1 | \
  grep -i --line-buffered "health\|down\|alert\|notify\|fail" || true

echo ""
echo "  Note: Full notification test requires 5-minute outage + webhook config."
echo "  Worker health monitor checks every 5 minutes per SD §35.1.5."

# 4. Restart the service
echo ""
echo "[4/4] Restarting $SERVICE..."
docker compose -f "$COMPOSE_FILE" start "$SERVICE"

ELAPSED=0
MAX_WAIT=30
while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -sf "$HEALTHZ_URL" > /dev/null 2>&1; then
    echo "  OK $SERVICE is back up after ${ELAPSED}s"
    break
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  INFO TEST RESULT: Manual verification required"
echo "  Check: worker logs for health alert entries"
echo "  Check: admin email/WA for notification (if configured)"
echo "═══════════════════════════════════════════════════════════"

