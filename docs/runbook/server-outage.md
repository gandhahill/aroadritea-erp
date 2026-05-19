# Runbook — VPS outage triage

> RTO target: **2 minutes**. ADR-0009.

## Symptom check (30 sec)

1. **Public site down?** `curl -I https://aroadritea.com` — expect 200.
2. **ERP down?** `curl -I https://erp.aroadritea.com/api/healthz` — expect 200.
3. **MCP down?** `curl -I https://mcp.aroadritea.com/healthz` — expect 200.

If all three fail → VPS-level (steps 1–3). If only one fails → app-level (step 4).

## Step 1 — Confirm VPS reachable

```bash
ping -c 3 erp.aroadritea.com
ssh aroadritea@<vps-ip>
```

If unreachable: check Hetzner/RumahWeb console for the VPS. Reboot from
console if needed (last-resort; loses warm caches).

## Step 2 — Check PM2 processes

```bash
pm2 status
```

Expected processes (per ADR-0012):

- `aroadri-web` (port 3000)
- `aroadri-site` (port 3001)
- `aroadri-mcp` (port 3002)
- `aroadri-worker` (no port)

Any in `errored` / `stopped` state → restart:

```bash
pm2 restart <name>
pm2 logs <name> --lines 100
```

## Step 3 — Check Nginx + HestiaCP

```bash
sudo systemctl status nginx
sudo nginx -t
```

If config invalid: `sudo nginx -s reload` after fixing.

## Step 4 — App-level — Postgres / Neon

If only one app is unhealthy but PM2 says it's running, the upstream DB
is probably down.

```bash
psql "$DATABASE_URL" -c "select 1"
```

If Neon is in compute-suspended state, the first POS write will wake it
(~5 s cold start). POS PWA queues writes locally during the gap.

## Step 5 — POS resilience check

Even with the server down, the cashier PWA must keep taking orders
offline (ADR-0009, RPO 0 for POS). Confirm at one outlet:

1. Cashier laptop opens `/pos`.
2. Place a test order — should queue with "Offline" badge.
3. Once VPS is restored, click "Sync now" — order should post.

## Step 6 — Post-mortem

After service restored:

- Capture `pm2 logs` of the failing window.
- Note any data loss (POS PWA logs help).
- Update `TASK.md` with a postmortem entry under "Incidents".
- File ADR if a recurring failure mode emerged.

## Escalation

If RTO 2 min slips past 15 min, page the PIC (Lintang) and notify
operations WhatsApp group with current status + ETA.
