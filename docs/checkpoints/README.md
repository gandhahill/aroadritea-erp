# docs/checkpoints/

Folder ini berisi **file checkpoint** untuk task yang sedang IN_PROGRESS atau baru selesai (≤ 7 hari).

## Tujuan

Memungkinkan AI developer untuk:
- Berhenti di tengah jalan (token limit) tanpa kehilangan konteks.
- Diserahterimakan ke AI lain (atau model berbeda) tanpa onboarding ulang.
- Audit jejak proses implementasi setelah selesai.

## Format

- Satu file per task: `<TASK_ID>-<slug>.checkpoint.md` (mis. `0042-journal-posting.checkpoint.md`).
- Format mengikuti `TEMPLATE.checkpoint.md`.

## Lifecycle

1. **Create**: saat task pindah dari Backlog → Active di `TASK.md`.
2. **Update**: setiap kali AI menulis 100+ baris code atau menyelesaikan satu sub-step.
3. **Final update saat berhenti**: AI **wajib** isi `## Next step` eksplisit.
4. **Final update saat selesai**: tandai status 🟩 DONE, isi commit, link PR.
5. **Archive**: setelah 7 hari dari completion, pindahkan ke `archive/` (atau hapus bila tidak signifikan).

## Aturan untuk AI Developer

- **Jangan** mulai task baru tanpa membuat file checkpoint.
- **Jangan** edit file checkpoint AI lain yang masih IN_PROGRESS dan owner-nya aktif (`Last updated` < 1 jam idle).
- **Jangan** vague di `## Next step`. Tulis perintah konkret dengan file path + line number + signature function.
- **Jangan** lupa commit `wip()` sebelum keluar — supaya code tidak hilang.

## Lihat Juga

- `../../TASK.md` — register task aktif & backlog
- `../../SYSTEM-DESIGN.md §37` — spesifikasi workflow lengkap
