# ADR-0009: Resilience & Auto-Recovery

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §25 (Resilience & Auto-Recovery), §21.1 (Pain Points)
- **Konteks teknis**: SYSTEM-DESIGN §35 (Resilience & Auto-Recovery)

## Konteks

Server VPS Aroadri sangat ketat (1 vCPU / 2 GB RAM). Risiko nyata:
- **OOM kill** karena memory pressure (Next.js + worker + Caddy + DB connections).
- **Process crash** karena exception unhandled.
- **Internet putus** di toko (Indibiz "kadang putus" — SoT §21.1).
- **Listrik padam** di toko, POS device reboot.
- **Server reboot** karena upgrade paket/security.

Konsekuensi bila tidak ditangani: **layanan berhenti total saat sedang melayani pelanggan** = kehilangan revenue dan reputasi.

User secara eksplisit meminta:
1. Layanan tetap berjalan saat server down (offline).
2. Sinkronisasi otomatis saat server kembali online.
3. Mekanisme auto-recovery (tidak perlu intervensi manual).

## Keputusan

Strategi **resilience berlapis** yang tidak menggantungkan pada single failure point.

### Layer 1 — POS Client (PWA Offline-First)

| Komponen | Implementasi |
|---|---|
| Service Worker | Serwist precache shell + assets statis |
| Master Data Cache | IndexedDB `products`, `variants`, `modifiers`, `tax_rates`, `promotions` (refresh tiap 5 menit saat online) |
| Outbox | IndexedDB `pending_orders` dengan field `idempotency_key`, `payload`, `attempts`, `last_error`, `next_retry_at` |
| Network detection | `navigator.onLine` + heartbeat ping `/api/healthz` setiap 60 detik |
| Sync flush | Background sync API (Chrome) atau setInterval 30s; exponential backoff 30 → 60 → 120 → 300 → 600s (cap 1 jam) |
| UX banner offline | "Offline — N transaksi pending" (kuning), tetap menerima order |
| UX banner sync gagal | Notifikasi merah setelah 3 retry beruntun gagal |

**Recovery POS**: setelah listrik pulih + browser kiosk auto-launch → outbox masih ada, sync resume otomatis.

### Layer 2 — Server Process

| Komponen | Implementasi |
|---|---|
| Container restart | Docker Compose `restart: unless-stopped` untuk semua service |
| Healthcheck | `/healthz` endpoint cek DB pool + return 200; Docker `HEALTHCHECK` |
| Memory limit | Per service `mem_limit` + Node `--max-old-space-size` |
| Graceful shutdown | SIGTERM handler: drain HTTP, flush logs, close DB pool |
| Caddy upstream | `lb_try_duration 5s` + maintenance.html bila upstream unhealthy |
| Idempotency server-side | Tabel `idempotency_records (key, scope, response_json, expires_at)` cache 24 jam |

**Recovery server**: container yang OOM-kill atau crash → Docker auto-restart < 30 detik; healthcheck konfirmasi sehat sebelum Caddy route.

### Layer 3 — Database

- Managed Postgres (Neon/Supabase) — provider menangani replikasi & failover.
- Connection pool dengan retry transient errors (`postgres-js` punya `max_lifetime` + auto-reconnect).
- Migrasi additive (zero-downtime style); 2-step untuk DROP COLUMN.

### Layer 4 — Worker

- Queue ringan: `pg-boss` (Postgres-backed; tidak perlu Redis tambahan, hemat RAM).
- Job idempotent dengan retry policy 3x exponential backoff; final fail → DLQ table + notifikasi admin.
- Cron: backup harian, ISR revalidate, low-stock alert, demo cleanup periodic.

### Layer 5 — Monitoring

| Tipe | Tool | Frekuensi |
|---|---|---|
| Internal cron | Worker hit `/healthz` semua service | 5 menit |
| External uptime | UptimeRobot / Better Stack free tier | 5 menit |
| Memory alert | Worker baca `/proc/meminfo` (di Docker) | 5 menit |
| Backup verification | Worker verifikasi ukuran backup harian | daily |

### Layer 6 — Notifikasi Outage

- **WhatsApp**: webhook ke nomor admin (via WA Business API atau Twilio bila ada).
- **Email**: ke `lintangmaulanazulfan@gmail.com`.
- Pesan: timestamp, service, durasi, last error, link runbook.

### Definisi "Resilient-Ready" untuk POS
Modul POS lulus deploy ke production hanya bila semua **8 skenario test** di SYSTEM-DESIGN §35.2 lulus:
1. Cabut jaringan saat order → tetap selesaikan.
2. Sambungkan kembali → outbox flush ≤ 30s.
3. Stop container `web` saat ada outbox → maintenance page; restart < 30s; flush.
4. OOM kill simulasi → restart < 30s.
5. Reboot POS device dengan outbox → setelah boot, outbox masih ada; sync resume.
6. Submit dua kali (idempotency) → 1 record saja.
7. Server down 5 menit → notifikasi terkirim.
8. DB connection drop → reconnect < 5s; tidak ada request hilang.

Skrip test di `scripts/resilience-tests/*.ts` (Playwright + skrip docker).

### RTO / RPO
- **RTO**: ≤ 2 menit (crash → service healthy).
- **RPO**:
  - POS: **0 transaksi hilang**.
  - Modul lain: ≤ 1 jam (kompromi karena tidak offline-capable).

## Alternatif yang Dipertimbangkan

### A. Tanpa offline mode, andalkan internet stabil
- Pros: Sederhana.
- Cons: Internet toko terbukti tidak stabil. **Ditolak**.

### B. Hot standby server (active-passive)
- Pros: RTO sangat rendah.
- Cons: Biaya 2x server. **Ditolak Phase 1**.

### C. Multi-region database
- Pros: HA tinggi.
- Cons: Latency + biaya. **Ditolak**.

### D. Pakai Kubernetes self-managed
- Pros: Fitur HA lengkap.
- Cons: Butuh ≥ 3 node, kompleksitas, RAM overhead besar. **Ditolak** (overkill untuk skala saat ini).

### E. Synchronous replication ke device kasir kedua
- Pros: Failover lokal.
- Cons: Aroadri Malioboro hanya 1 mesin POS saat ini (lihat foto SoT). **Ditolak Phase 1**, opsi Phase 3+ saat outlet membesar.

## Konsekuensi

### Positif
- **Zero data loss POS**: transaksi tidak akan hilang karena outbox + idempotency.
- **Layanan tetap jalan**: meski server down / internet putus / listrik padam.
- **Auto-recovery**: tanpa intervensi manual untuk crash standar.
- **Notifikasi proaktif**: admin tahu sebelum pelanggan komplain.
- **Hemat biaya**: tidak butuh standby server / Redis / multi-region.

### Negatif / Trade-off
- **Modul non-POS tetap rentan**: akuntansi/HR tidak offline-capable. Mitigasi: user dilatih untuk retry manual; modul-modul ini biasanya tidak time-critical seperti POS.
- **Service worker complexity**: butuh testing rigorous. Mitigasi: 8 test scenarios dijalankan tiap deploy.
- **Idempotency record retention**: tabel `idempotency_records` bisa membesar. Mitigasi: TTL 24 jam dengan cron cleanup.
- **WA Business API butuh provisioning**: bila tidak tersedia, fallback ke email saja.

### Neutral
- **Naixer KDS**: tidak terpengaruh oleh outage server kita (komunikasi via QR di label fisik). Lihat ADR-0007.

## Implementasi Checklist

### Phase 1 (Foundation)
- [ ] `/healthz` endpoint di apps/web, apps/site, apps/mcp.
- [ ] Docker Compose dengan restart policy + healthcheck + mem_limit.
- [ ] `--max-old-space-size` di startup commands.
- [ ] Connection pool retry config.
- [ ] Caddy upstream healthcheck + maintenance.html.
- [ ] Tabel `idempotency_records` + cron cleanup.

### Phase 2 (POS)
- [ ] PWA precache shell.
- [ ] IndexedDB outbox.
- [ ] Heartbeat sync.
- [ ] Server-side idempotency handling.
- [ ] 8 test resilience scenarios.

### Phase 6 (Monitoring & Notifikasi)
- [ ] UptimeRobot / Better Stack setup.
- [ ] Worker job memory check + healthcheck loop.
- [ ] Notifikasi outage webhook (email + WA).
- [ ] Runbook: `docs/runbook/server-outage.md`, `docs/runbook/restore-from-backup.md`.

## Referensi

- Mogk et al. (2019), "A fault-tolerant programming model for distributed interactive applications", *PACMPL*, 3(OOPSLA) — referensi resilience pada distributed apps.
- Sanjuan et al. (2020), "Algebraic Replicated Data Types: Programming Secure Local-First Software" — referensi local-first apps (relevan untuk PWA offline POS).
- SOURCE-OF-TRUTH.md §25, §21.1
- SYSTEM-DESIGN.md §35
- ADR-0001 (Stack), ADR-0002 (App Split)
