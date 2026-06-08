/**
 * /api/hr/payslip/[payrollId]/[employeeId]
 *
 * Renders a print-ready HTML payslip for the requested payroll line.
 * The browser's "Save as PDF" produces the actual PDF — adding a heavy
 * PDF library would breach the 2 GB RAM constraint documented in
 * CLAUDE.md §5.7.
 *
 * Permission is enforced inside `getEmployeePayslip` (employee can see
 * their own; HR / payroll admin can see anyone in their outlet).
 */

import { getSession } from '@/lib/auth';
import { getEmployeePayslip } from '@erp/services/payroll';
import type { AuditContext } from '@erp/shared/types';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function fmt(amount: string): string {
  const cents = BigInt(amount);
  return IDR_FORMATTER.format(Number(cents));
}

function htmlEscape(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ payrollId: string; employeeId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  const { payrollId, employeeId } = await params;
  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };

  const result = await getEmployeePayslip({ payrollId, employeeId }, ctx);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.messageKey ?? 'payslip.unavailable' },
      { status: result.error.httpStatus ?? 403 },
    );
  }
  const data = result.value;

  const earningsRows = data.earnings
    .map(
      (line) =>
        `<tr><td>${htmlEscape(line.componentName)}${line.notes ? `<br/><span style="font-size:10px;color:#73685c">${htmlEscape(line.notes)}</span>` : ''}</td><td class="num">${fmt(line.amount)}</td></tr>`,
    )
    .join('');
  const deductionsRows = data.deductions
    .map(
      (line) =>
        `<tr><td>${htmlEscape(line.componentName)}${line.notes ? `<br/><span style="font-size:10px;color:#73685c">${htmlEscape(line.notes)}</span>` : ''}</td><td class="num">${fmt(line.amount)}</td></tr>`,
    )
    .join('');

  const periodLabel = `${data.periodStart.toISOString().slice(0, 10)} → ${data.periodEnd
    .toISOString()
    .slice(0, 10)}`;

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Slip Gaji ${htmlEscape(data.employee.name)} – ${htmlEscape(data.periodCode)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter','Helvetica Neue',Arial,sans-serif; color:#1f1b16; background:#f7f2ea; margin:0; }
  .sheet { max-width: 720px; margin: 24px auto; background:#fff; padding:32px; border-radius:14px; box-shadow:0 2px 12px rgba(0,0,0,.06); }
  .logo-row { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
  .logo-row img { height:48px; width:auto; }
  h1 { font-size: 18px; margin:0 0 4px; color:#bb2a2a; letter-spacing:.4px; text-transform:uppercase; }
  h2 { font-size: 13px; margin:0 0 18px; color:#4a423b; font-weight:500; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px; }
  .grid section { font-size: 12px; line-height: 1.55; color:#4a423b; }
  .grid section strong { display:block; color:#1f1b16; font-weight:600; margin-bottom:4px; text-transform: uppercase; font-size: 11px; letter-spacing: .4px; }
  table { width:100%; border-collapse: collapse; font-size:13px; }
  table th, table td { padding: 8px 6px; border-bottom: 1px solid #eee3d4; text-align:left; }
  table th { text-transform: uppercase; font-size: 11px; letter-spacing: .4px; color:#73685c; }
  .num { text-align:right; font-variant-numeric: tabular-nums; }
  .section-title { margin: 18px 0 6px; font-size: 12px; color:#73685c; text-transform: uppercase; letter-spacing:.4px; }
  .totals { margin-top: 16px; padding: 12px 14px; background:#f7f2ea; border-radius: 10px; }
  .totals .row { display:flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
  .totals .net { font-weight: 700; font-size: 16px; color:#bb2a2a; margin-top: 8px; border-top: 1px dashed #d5c9b8; padding-top: 10px; }
  .actions { text-align:center; margin: 20px auto; }
  .actions button { font-family: inherit; background:#bb2a2a; color:#fff; border:none; padding: 8px 18px; border-radius: 8px; cursor: pointer; }
  footer { margin-top: 20px; font-size: 11px; color:#73685c; text-align:center; }
  @media print {
    body { background:#fff; }
    .actions { display:none; }
    .sheet { box-shadow: none; margin: 0; border-radius: 0; padding: 8mm; }
    a { color:inherit; text-decoration:none; }
  }
</style>
</head>
<body>
<div class="actions"><button onclick="window.print()">Simpan / Cetak PDF</button></div>
<article class="sheet">
  <div class="logo-row">
    <img src="/logo-primary.png" alt="Aroadri Tea" />
    <div>
      <h1>Slip Gaji</h1>
      <h2>Periode ${htmlEscape(data.periodCode)} (${periodLabel})</h2>
    </div>
  </div>

  <div class="grid">
    <section>
      <strong>Pemberi Kerja</strong>
      ${htmlEscape(data.employer.legalName)}<br/>
      ${htmlEscape(data.employer.locationName)}<br/>
      ${htmlEscape(data.employer.address ?? '')}
    </section>
    <section>
      <strong>Karyawan</strong>
      ${htmlEscape(data.employee.name)}<br/>
      ${htmlEscape(data.employee.position)}${data.employee.department ? ` · ${htmlEscape(data.employee.department)}` : ''}<br/>
      NIK: ${data.employee.nik ? htmlEscape(data.employee.nik) : '—'}<br/>
      Email: ${htmlEscape(data.employee.email)}
    </section>
  </div>

  <p class="section-title">Pendapatan</p>
  <table>
    <thead><tr><th>Komponen</th><th class="num">Jumlah</th></tr></thead>
    <tbody>${earningsRows || '<tr><td colspan="2"><em>tidak ada</em></td></tr>'}</tbody>
  </table>

  <p class="section-title">Potongan</p>
  <table>
    <thead><tr><th>Komponen</th><th class="num">Jumlah</th></tr></thead>
    <tbody>${deductionsRows || '<tr><td colspan="2"><em>tidak ada</em></td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Total Pendapatan</span><span class="num">${fmt(data.totals.earnings)}</span></div>
    <div class="row"><span>Total Potongan</span><span class="num">${fmt(data.totals.deductions)}</span></div>
    <div class="row net"><span>Gaji Bersih (THP)</span><span class="num">${fmt(data.totals.net)}</span></div>
  </div>

  <footer>
    Status payroll: <strong>${htmlEscape(data.status)}</strong>
    ${data.approvedAt ? ` · Disetujui ${data.approvedAt.toISOString().slice(0, 10)}` : ''}
    ${data.journalEntryNumber ? ` · Jurnal ${htmlEscape(data.journalEntryNumber)}` : ''}
    <br/>Slip ini dihasilkan otomatis oleh Aroadri Tea ERP. Tidak memerlukan tanda tangan basah.
  </footer>
</article>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      // Allow same-origin embedding so the in-app preview modal (iframe) works,
      // matching the SOP/uploads viewer. The global policy is frame DENY.
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  });
}
