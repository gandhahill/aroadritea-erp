# ADR-0012: PM2 + HestiaCP Untuk Runtime Production VPS

- **Status**: Accepted
- **Tanggal**: 2026-05-14
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: deployment production Aroadri Tea ERP di VPS HestiaCP
- **Konteks teknis**: SYSTEM-DESIGN §26, §35; README §6

## Konteks

Deployment Docker Compose bermasalah di VPS production HestiaCP. VPS tetap memakai constraint 1 vCPU / 2 GB RAM / 60 GB disk dan HestiaCP sudah menyediakan Nginx/Apache, SSL, domain, dan mail panel.

Keputusan awal Docker + Caddy bagus untuk portabilitas, tetapi pada server ini menambah lapisan operasional yang tidak diperlukan karena reverse proxy dan SSL sudah dikelola HestiaCP.

## Keputusan

Runtime production VPS memakai PM2 untuk proses Node.js:

- `aroadri-site` di port lokal `3000`.
- `aroadri-web` di port lokal `3001`.
- `aroadri-mcp` di port lokal `3002` dengan `MCP_ENABLE_STDIO=false` agar PM2 berjalan sebagai health daemon.
- `aroadri-worker` tanpa port HTTP publik.

Semua proses HTTP PM2 wajib bind ke `127.0.0.1`, bukan `0.0.0.0`. Port 3000-3002 hanya boleh diakses dari reverse proxy lokal HestiaCP.

HestiaCP tetap menjadi reverse proxy publik untuk:

- `aroadritea.com` dan `www.aroadritea.com` → `http://127.0.0.1:3000`
- `erp.aroadritea.com` → `http://127.0.0.1:3001`
- `erp.aroadritea.com/mcp/` → `http://127.0.0.1:3002/`

Proxy HestiaCP/Nginx wajib meneruskan header publik `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, dan `X-Forwarded-Port`. Redirect aplikasi harus tetap memakai domain publik, bukan upstream loopback.

Subdomain MCP bertingkat (`mcp.erp.aroadritea.com`) tidak menjadi default production karena Cloudflare Universal SSL standar tidak mencakup nested wildcard. Jika nanti butuh subdomain terpisah, gunakan `mcp.aroadritea.com`, DNS-only, atau Advanced Certificate.

Konfigurasi PM2 resmi ada di `ecosystem.config.cjs`.

Transport utama MCP tetap `stdio` untuk klien AI lokal. Mode HTTP/SSE remote belum menjadi jalur production utama dan harus token-gated jika diaktifkan nanti.

## Alternatif yang Dipertimbangkan

### Docker Compose + Caddy

- Pros: isolated, reproducible, restart policy dan healthcheck built-in.
- Ditolak untuk production VPS saat ini karena bermasalah pada deployment HestiaCP dan menambah reverse proxy kedua.

### systemd Service Manual

- Pros: native Linux, minim dependency.
- Ditolak karena PM2 lebih cepat untuk multi-process Node.js, log, restart, dan reload env.

### Vercel / Managed Hosting

- Pros: mudah untuk Next.js.
- Ditolak karena ERP, MCP, worker, dan POS offline sync perlu kontrol VPS dan biaya tetap rendah.

## Konsekuensi

- Positif: deployment lebih sederhana di HestiaCP; tidak perlu Docker daemon untuk runtime app.
- Positif: PM2 memberi auto-restart, memory restart, log, dan startup systemd.
- Positif: port app tetap lokal dan tidak perlu dibuka publik.
- Negatif: dependency runtime global (`pm2`) harus dikelola di VPS.
- Negatif: isolasi lebih rendah dibanding container; perlu disiplin `.env`, user permission, dan firewall.
- Neutral: Docker config lama boleh tetap ada sebagai referensi/opsi staging, tetapi bukan jalur production utama.

## Referensi

- `ecosystem.config.cjs`
- `README.md §6`
- `docs/PRODUCTION-READINESS.md`
