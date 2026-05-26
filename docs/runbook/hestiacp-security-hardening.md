# HestiaCP Security Hardening Runbook

This runbook closes the VPS-side findings from the 2026-05 pentest. It must be executed on the production VPS by the operator with root or sudo access before the ERP is considered production-ready.

## Findings Covered

- `INF-001`: HestiaCP and admin services exposed to the public internet.
- `INF-002`: IP/default virtual host can route to application surfaces.
- `INF-003`: HestiaCP 1.9.4 has critical upstream advisories and must be upgraded.
- `INF-004`: Unused service ports increase attack surface.
- `INF-005`: Infrastructure service banners expose implementation details.

## Required State

- Public internet exposes only `80/tcp` and `443/tcp`.
- HestiaCP panel `8083/tcp` is reachable only from the admin IP range or VPN.
- App processes bind to `127.0.0.1` only and are reachable through HestiaCP reverse proxy.
- Unknown hosts and direct IP requests return `404`, `421`, or a blank default page, never ERP/site/MCP content.
- `TRUSTED_PROXY_HEADER_SECRET` is set in app `.env` and injected by the reverse proxy.

## HestiaCP Upgrade

1. Snapshot the VPS and confirm the latest off-site backup exists.
2. Check the running version:
   ```bash
   v-list-sys-hestia-updates
   ```
3. Upgrade HestiaCP and packages:
   ```bash
   apt update
   apt full-upgrade -y
   v-update-sys-hestia-all
   systemctl restart hestia
   ```
4. Verify the HestiaCP version is no longer `1.9.4`:
   ```bash
   v-list-sys-hestia-updates
   ```
5. If the panel cannot be upgraded immediately, restrict `8083/tcp` to admin/VPN IPs first and record the deferral in `TASK.md`.

## Firewall Baseline

Replace `ADMIN_IP_CIDR` with the actual office/VPN public IP range.

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from ADMIN_IP_CIDR to any port 22 proto tcp
ufw allow from ADMIN_IP_CIDR to any port 8083 proto tcp
ufw deny 8083/tcp
ufw deny 21/tcp
ufw deny 25/tcp
ufw deny 53
ufw deny 110/tcp
ufw deny 143/tcp
ufw deny 465/tcp
ufw deny 587/tcp
ufw deny 993/tcp
ufw deny 995/tcp
ufw enable
ufw status verbose
```

Open mail, DNS, or FTP ports only if that service is intentionally hosted on this VPS. The default ERP deployment uses HestiaCP SMTP mailbox from the server but does not require public inbound mail/FTP/DNS for ERP traffic.

## Reverse Proxy Requirements

For each HestiaCP proxy template that forwards to the Node apps, add these headers:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Aroadri-Proxy-Secret "__TRUSTED_PROXY_HEADER_SECRET__";
proxy_hide_header X-Powered-By;
proxy_hide_header Server;
```

The value must match `.env`:

```dotenv
TRUSTED_PROXY_HEADER_SECRET=<long-random-secret>
TRUST_PROXY_HEADERS=false
HEALTHZ_DETAIL_TOKEN=<long-random-secret>
```

Do not expose PM2 or Node ports publicly. Verify listeners:

```bash
ss -ltnp
```

Expected app listeners are `127.0.0.1:3000`, `127.0.0.1:3001`, `127.0.0.1:3002`, and worker without a public port.

## Default Host / Direct IP

Create a default HestiaCP/Nginx vhost for unmatched hosts and the server IP. It must not proxy to ERP apps.

```nginx
server {
    listen 80 default_server;
    server_name _;
    return 404;
}

server {
    listen 443 ssl default_server;
    server_name _;
    return 421;
}
```

After reload:

```bash
nginx -t
systemctl reload nginx
curl -I http://SERVER_IP/
curl -kI https://SERVER_IP/
curl -I https://erp.aroadritea.com/api/healthz
```

Expected:

- Direct IP returns `404` or `421`.
- `/api/healthz` returns only `{"status":"ok"}` unless `x-healthz-token` is provided.
- `X-Powered-By` is absent.

## HestiaCP Panel Controls

- Disable the HestiaCP web terminal if not actively used.
- Enforce a unique strong panel password and keep the admin account outside source control.
- Disable unused Hestia users/domains/services.
- Keep automatic security updates enabled.
- Review `/var/log/hestia/auth.log`, `/var/log/nginx/access.log`, and `/var/log/nginx/error.log` after every deployment.

## Verification Checklist

- [ ] HestiaCP upgraded from vulnerable `1.9.4`.
- [ ] `8083/tcp` inaccessible from a non-admin network.
- [ ] Only required public ports are open.
- [ ] Node/PM2 services listen on localhost only.
- [ ] Direct IP and unknown host do not serve ERP/site/MCP.
- [ ] Reverse proxy injects `X-Aroadri-Proxy-Secret`.
- [ ] Health endpoints return minimal responses without detail token.
- [ ] Findings `INF-001` through `INF-005` marked remediated in the pentest tracker.
