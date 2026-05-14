# Checkpoint: T-0030 — Resilience Tests Scripts

## Status: 🟩 DONE
- **Started**: 2026-05-09
- **Completed**: 2026-05-09

## Scope
Per SYSTEM-DESIGN §35.2: 8 test scenarios for production deploy readiness.

## Deliverables
- `scripts/resilience-tests/README.md` — overview + test matrix
- `scripts/resilience-tests/run-all.sh` — runner script
- `scripts/resilience-tests/03-container-restart.sh` — scenario 3: stop+restart timing
- `scripts/resilience-tests/04-oom-kill.sh` — scenario 4: SIGKILL auto-recovery
- `scripts/resilience-tests/07-server-down-notify.sh` — scenario 7: down notification
- `scripts/resilience-tests/08-db-reconnect.sh` — scenario 8: DB reconnect timing

## Notes
- Scenarios 1, 2, 5, 6 scheduled for Phase 2 (require POS PWA + sync endpoint)
- 4 of 8 scenarios implemented as bash scripts
- Scripts test against Docker Compose deployment on staging
