/**
 * reporting.financialStatementNotes -- SAK EP notes scaffold.
 *
 * Generates the structured disclosure baseline for Catatan atas Laporan Keuangan
 * without claiming final compliance before the full report package is reviewed.
 */

import { AppError } from '@erp/shared/errors';
import { type Result, tryCatch } from '@erp/shared/result';
import type { AuditContext, LocaleString } from '@erp/shared/types';
import { requirePermission } from '../iam';

export interface FinancialStatementNotesInput {
  periodStart: string;
  periodEnd: string;
  reportingDate: string;
  locationId?: string;
  firstSakEpFinancialStatements?: boolean;
  previousFramework?: string;
}

export interface FinancialStatementNotesSection {
  code: string;
  title: LocaleString;
  paragraphs: LocaleString[];
  sourceRefs: string[];
}

export interface FinancialStatementChecklistItem {
  code: string;
  title: LocaleString;
  status: 'available' | 'required';
  service?: string;
}

export interface FinancialStatementNotesResult {
  framework: 'SAK_EP';
  frameworkName: LocaleString;
  periodStart: string;
  periodEnd: string;
  reportingDate: string;
  locationId: string | null;
  currency: 'IDR';
  measurementBasis: 'historical_cost_unless_disclosed';
  accountingBasis: {
    accrual: true;
    cashFlow: 'cash_basis_classification';
  };
  requiredStatements: FinancialStatementChecklistItem[];
  sections: FinancialStatementNotesSection[];
  complianceWarnings: FinancialStatementNotesSection[];
}

const text = (id: string, en: string, zh: string): LocaleString => ({ id, en, zh });

export async function financialStatementNotes(
  input: FinancialStatementNotesInput,
  ctx: AuditContext,
): Promise<Result<FinancialStatementNotesResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    input.locationId ? 'accounting.view' : 'reporting.consolidated',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => ({
      framework: 'SAK_EP' as const,
      frameworkName: text(
        'SAK Indonesia untuk Entitas Privat',
        'Indonesian Financial Accounting Standards for Private Entities',
        '印度尼西亚私营实体财务会计准则',
      ),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      reportingDate: input.reportingDate,
      locationId: input.locationId ?? null,
      currency: 'IDR' as const,
      measurementBasis: 'historical_cost_unless_disclosed' as const,
      accountingBasis: {
        accrual: true as const,
        cashFlow: 'cash_basis_classification' as const,
      },
      requiredStatements: requiredStatements(),
      sections: sections(input),
      complianceWarnings: complianceWarnings(),
    }),
    (e) => AppError.internal('reporting.financialStatementNotes.failed', e),
  );
}

function requiredStatements(): FinancialStatementChecklistItem[] {
  return [
    {
      code: 'statement_of_financial_position',
      title: text('Laporan Posisi Keuangan', 'Statement of Financial Position', '财务状况表'),
      status: 'available',
      service: 'reporting.balanceSheet',
    },
    {
      code: 'profit_or_loss_and_comprehensive_income',
      title: text(
        'Laporan Laba Rugi dan Penghasilan Komprehensif',
        'Statement of Profit or Loss and Comprehensive Income',
        '损益及综合收益表',
      ),
      status: 'available',
      service: 'reporting.profitLoss',
    },
    {
      code: 'statement_of_changes_in_equity',
      title: text('Laporan Perubahan Ekuitas', 'Statement of Changes in Equity', '权益变动表'),
      status: 'available',
      service: 'reporting.equityChanges',
    },
    {
      code: 'statement_of_cash_flows',
      title: text('Laporan Arus Kas', 'Statement of Cash Flows', '现金流量表'),
      status: 'available',
      service: 'reporting.cashFlow',
    },
    {
      code: 'notes_to_financial_statements',
      title: text(
        'Catatan atas Laporan Keuangan',
        'Notes to the Financial Statements',
        '财务报表附注',
      ),
      status: 'available',
      service: 'reporting.financialStatementNotes',
    },
  ];
}

function sections(input: FinancialStatementNotesInput): FinancialStatementNotesSection[] {
  const transitionNote =
    input.firstSakEpFinancialStatements === true
      ? [
          text(
            `Laporan ini merupakan laporan keuangan pertama berdasarkan SAK EP. Rekonsiliasi dari ${input.previousFramework ?? 'kerangka sebelumnya'} ke SAK EP harus dilampirkan sebelum laporan final diterbitkan.`,
            `These are the first financial statements prepared under SAK EP. Reconciliations from ${input.previousFramework ?? 'the previous framework'} to SAK EP must be attached before final issuance.`,
            `本期为首次按照 SAK EP 编制的财务报表。发布最终报表前，应附上从${input.previousFramework ?? '以前准则'}至 SAK EP 的调节表。`,
          ),
        ]
      : [];

  return [
    {
      code: 'basis_of_preparation',
      title: text('Dasar Penyusunan', 'Basis of Preparation', '编制基础'),
      paragraphs: [
        text(
          'Laporan keuangan disusun untuk tujuan umum berdasarkan SAK Indonesia untuk Entitas Privat, dengan dasar akrual kecuali laporan arus kas.',
          'The financial statements are general-purpose financial statements prepared under SAK EP on the accrual basis, except for the statement of cash flows.',
          '财务报表为通用目的报表，按 SAK EP 及权责发生制编制，现金流量表除外。',
        ),
        text(
          'Mata uang penyajian adalah Rupiah Indonesia (IDR). Dasar pengukuran utama adalah biaya historis, kecuali kebijakan tertentu mengungkapkan basis lain.',
          'The presentation currency is Indonesian Rupiah (IDR). The primary measurement basis is historical cost unless a specific policy discloses another basis.',
          '列报货币为印尼盾（IDR）。主要计量基础为历史成本，除非特定政策披露其他基础。',
        ),
        ...transitionNote,
      ],
      sourceRefs: ['SAK EP Bab 2', 'SAK EP Bab 3', 'SAK EP Bab 35'],
    },
    {
      code: 'revenue_and_pbjt',
      title: text('Pendapatan dan PBJT', 'Revenue and PBJT', '收入及 PBJT'),
      paragraphs: [
        text(
          'Pendapatan retail F&B diakui neto dari PB1/PBJT 10% yang bersifat inclusive. Nilai gross kasir dipisahkan menjadi omzet neto dan utang PBJT.',
          'Retail F&B revenue is recognized net of the inclusive 10% PB1/PBJT. POS gross receipts are split into net revenue and PBJT payable.',
          '零售餐饮收入扣除内含 10% PB1/PBJT 后确认。POS 总收款拆分为净收入及应付 PBJT。',
        ),
      ],
      sourceRefs: ['SAK EP Bab 23', 'UU HKPD', 'SoT §6.5', 'SoT §11'],
    },
    {
      code: 'vat_and_income_tax',
      title: text('PPN dan Pajak Penghasilan', 'VAT and Income Tax', '增值税及所得税'),
      paragraphs: [
        text(
          'PPN keluaran untuk retail F&B default nonaktif karena transaksi makanan/minuman restoran dikenai PBJT. PPN masukan dari supplier PKP tetap dicatat sebagai pajak masukan sesuai dokumen pajak.',
          'Output VAT is disabled by default for retail F&B because restaurant food and beverage transactions are subject to PBJT. Input VAT from PKP suppliers remains recorded based on tax documents.',
          '零售餐饮默认不启用销项增值税，因为餐厅食品饮料交易适用 PBJT。来自 PKP 供应商的进项税仍按税务凭证记录。',
        ),
        text(
          'Untuk transaksi non-mewah yang kelak dikenai PPN, sistem memakai tarif efektif 11% sebagai 12% x DPP nilai lain 11/12, kecuali aturan pajak terbaru mengubahnya.',
          'For future non-luxury VATable transactions, the system uses the effective 11% rate as 12% x deemed tax base of 11/12, unless later regulations change it.',
          '未来适用增值税的非奢侈品交易，系统按 12% x 11/12 的计税基础形成 11% 有效税率，除非后续法规变更。',
        ),
        text(
          'PPh Final UMKM 0,5% diperlakukan sebagai aturan terpisah dari PPh Pasal 25; ambang Rp500 juta hanya untuk wajib pajak orang pribadi, bukan PT/badan.',
          'Final MSME income tax at 0.5% is treated separately from Article 25 installments; the Rp500 million exemption applies only to individual taxpayers, not corporate entities.',
          '0.5% 中小企业最终所得税与第25条预缴税分开处理；5亿印尼盾免税额仅适用于个人纳税人，不适用于公司。',
        ),
      ],
      sourceRefs: ['SAK EP Bab 29', 'PMK 131/2024', 'PMK 164/2023', 'ADR-0010'],
    },
    {
      code: 'inventory_and_fixed_assets',
      title: text('Persediaan dan Aset Tetap', 'Inventory and Fixed Assets', '存货及固定资产'),
      paragraphs: [
        text(
          'Persediaan diukur pada biaya perolehan dan diuji terhadap nilai realisasi neto bila ada indikasi penurunan nilai.',
          'Inventory is measured at cost and assessed against net realizable value when impairment indicators exist.',
          '存货按成本计量，如存在减值迹象则与可变现净值比较。',
        ),
        text(
          'Aset tetap dicatat sebesar biaya perolehan dan disusutkan secara sistematis selama masa manfaat; metode default Aroadri adalah garis lurus.',
          'Fixed assets are recorded at cost and depreciated systematically over useful lives; Aroadri default method is straight-line.',
          '固定资产按成本入账，并在使用寿命内系统折旧；Aroadri 默认采用直线法。',
        ),
      ],
      sourceRefs: ['SAK EP Bab 13', 'SAK EP Bab 17', 'SoT §10.4'],
    },
    {
      code: 'record_retention',
      title: text('Retensi Dokumen Pajak', 'Tax Document Retention', '税务资料保存'),
      paragraphs: [
        text(
          'Dokumen pembukuan pajak pusat disimpan 10 tahun, sedangkan dokumen PBJT daerah mengikuti ketentuan daerah dengan baseline retensi 5 tahun.',
          'National tax bookkeeping documents are retained for 10 years, while local PBJT documents follow regional rules with a 5-year baseline retention.',
          '国家税务账簿资料保存 10 年；地方 PBJT 文件遵循地方规定，基线保存期为 5 年。',
        ),
      ],
      sourceRefs: ['DDTC Tax Manual 2025', 'PMK 81/2024', 'UU HKPD'],
    },
  ];
}

function complianceWarnings(): FinancialStatementNotesSection[] {
  return [
    {
      code: 'explicit_compliance_statement',
      title: text('Pernyataan Kepatuhan SAK EP', 'SAK EP Compliance Statement', 'SAK EP 合规声明'),
      paragraphs: [
        text(
          'Pernyataan eksplisit bahwa laporan patuh SAK EP hanya boleh dicantumkan setelah seluruh laporan wajib, angka komparatif, klasifikasi, dan pengungkapan telah direview.',
          'An explicit SAK EP compliance statement should be included only after all required statements, comparative figures, classifications, and disclosures have been reviewed.',
          '只有在所有必需报表、比较数据、分类和披露均已复核后，才应列示明确的 SAK EP 合规声明。',
        ),
      ],
      sourceRefs: ['SAK EP Bab 3'],
    },
    {
      code: 'coretax_template_verification',
      title: text(
        'Verifikasi Template Coretax',
        'Coretax Template Verification',
        'Coretax 模板核验',
      ),
      paragraphs: [
        text(
          'File CSV/XLSX pajak harus diverifikasi terhadap template Coretax yang berlaku pada masa pajak terkait sebelum dipakai untuk pelaporan final.',
          'Tax CSV/XLSX files must be verified against the Coretax template applicable to the relevant tax period before final filing.',
          '税务 CSV/XLSX 文件在最终申报前，必须按相关税期适用的 Coretax 模板核验。',
        ),
      ],
      sourceRefs: ['PMK 81/2024', 'PER-11/PJ/2025'],
    },
  ];
}
