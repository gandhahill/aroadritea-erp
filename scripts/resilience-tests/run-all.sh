#!/bin/bash
# ────────────────────────────────────────────────────────────────────────────
# Run All Phase 1 Resilience Tests
# SD §35.2: Tiap deploy ke production harus lulus test berikut di staging.
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.yml}"

PASS=0
FAIL=0
SKIP=0

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   AROADRI TEA ERP — Resilience Test Suite (Phase 1)      ║"
echo "║   SD §35.2: 8 scenarios (4 Phase 1, 4 remaining)        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Compose file: $COMPOSE_FILE"
echo "Started at: $(date)"
echo ""

run_test() {
  local num="$1"
  local name="$2"
  local script="$3"

  echo "────────────────────────────────────────────────────────────"
  echo "  Test $num: $name"
  echo "────────────────────────────────────────────────────────────"

  if [ ! -f "$SCRIPT_DIR/$script" ]; then
    echo "  ⏳ SKIPPED — script not found (Phase 2)"
    SKIP=$((SKIP + 1))
    echo ""
    return
  fi

  if bash "$SCRIPT_DIR/$script"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
  echo ""

  # Brief pause between tests for system to stabilize
  sleep 5
}

run_test 1 "Offline POS Order"             "01-offline-pos-order.sh"
run_test 2 "Network Reconnect Sync"         "02-reconnect-sync.sh"
run_test 3 "Container Restart"              "03-container-restart.sh"
run_test 4 "OOM Kill Simulation"            "04-oom-kill.sh"
run_test 5 "Reboot POS Device"              "05-reboot-device.sh"
run_test 6 "Idempotency Double-Submit"      "06-idempotency.sh"
run_test 7 "Server Down Notification"       "07-server-down-notify.sh"
run_test 8 "DB Connection Drop"             "08-db-reconnect.sh"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   RESULTS                                                ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "    OK Passed:  $PASS"
echo "    ERROR Failed:  $FAIL"
echo "    Skipped: $SKIP (Phase 2)"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Finished at: $(date)"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0


