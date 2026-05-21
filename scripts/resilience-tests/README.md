# Resilience Tests — Aroadri Tea ERP
# SD §35.2: 8 scenarios, tested before every production deploy

## Overview

These scripts validate the RTO ≤ 2 minute and RPO = 0 (for POS) guarantees per SYSTEM-DESIGN §35.

### Test Matrix

| # | Scenario                           | Phase | Status      | Script                     |
|---|------------------------------------|-------|-------------|----------------------------|
| 1 | Offline POS order                  | 2     | ⏳ Deferred | `01-offline-pos-order.sh`  |
| 2 | Network reconnect sync             | 2     | ⏳ Deferred | `02-reconnect-sync.sh`     |
| 3 | Stop container + restart           | 1     | OK Ready    | `03-container-restart.sh`  |
| 4 | OOM kill simulation                | 1     | OK Ready    | `04-oom-kill.sh`           |
| 5 | Reboot POS device                  | 2     | ⏳ Deferred | `05-reboot-device.sh`      |
| 6 | Idempotency double-submit          | 2     | ⏳ Deferred | `06-idempotency.sh`        |
| 7 | Server down notification           | 1     | OK Ready    | `07-server-down-notify.sh` |
| 8 | DB connection drop                 | 1     | OK Ready    | `08-db-reconnect.sh`       |

## Usage

```bash
# Run all Phase 1 tests
./scripts/resilience-tests/run-all.sh

# Run individual test
./scripts/resilience-tests/03-container-restart.sh
```

## Prerequisites

- Docker + Docker Compose running with `docker/docker-compose.yml`
- All containers healthy
- `.env` configured with test database

## Notes

- Tests 1, 2, 5, 6 require POS PWA which is Phase 2 work
- Run tests on staging environment only, never on production
- Tests 3 and 4 will cause brief downtime


