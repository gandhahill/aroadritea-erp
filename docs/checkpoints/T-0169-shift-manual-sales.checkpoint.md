# Checkpoint T-0169: Integrasi Manual Sales dengan Shift Management

## Status
🟨 IN_PROGRESS

## Objective
Mengintegrasikan fitur Shift Management (Buka/Tutup Shift) dengan input dari form Manual Sales.
Ini memungkinkan pencatatan *Actual Cash* di laci kasir (fisik) untuk dibandingkan dengan *Expected Cash* (dari Manual Sales), dan sistem secara otomatis menjurnal variance (selisih) tersebut.

## Work Log
- Menambahkan T-0169 ke TASK.md
- Rencana implementasi sudah disetujui (auto-approve):
  - Tambah `shift_id` di `manual_sales_closings`.
  - Update `createManualSalesClosing` untuk bind shift.
  - Update `closeShift` untuk re-calculate expected cash dari manual sales.
  - Tambah logic jurnal selisih kas (Shortage -> 6-2100, Overage -> 7-1200).

## Next step
Edit `packages/db/schema/pos.ts`, line 60-70, tambahkan `shiftId: text('shift_id')` ke `manual_sales_closings`. Lalu run `pnpm drizzle-kit generate`.
