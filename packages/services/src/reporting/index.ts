/**
 * @erp/services/reporting — Reporting service barrel export.
 */

export {
  trialBalance,
  type TrialBalanceInput,
  type TrialBalanceLine,
  type TrialBalanceResult,
} from './trial-balance';

export {
  balanceSheet,
  type BalanceSheetInput,
  type BalanceSheetSection,
  type BalanceSheetResult,
} from './balance-sheet';

export {
  profitLoss,
  type ProfitLossInput,
  type ProfitLossLine,
  type ProfitLossSection,
  type ProfitLossResult,
} from './profit-loss';

export {
  equityChanges,
  type EquityChangesInput,
  type EquityChangesResult,
} from './equity-changes';

export {
  getGeneralLedger,
  type GeneralLedgerInput,
  type GeneralLedgerResult,
  type GeneralLedgerLine,
} from './general-ledger';

export {
  cashFlow,
  type CashFlowInput,
  type CashFlowMovement,
  type CashFlowSection,
  type CashFlowResult,
} from './cash-flow';

export {
  getDailySummary,
  type DailySummaryParams,
  type DailySummaryResult,
  type DailySummary,
  type PaymentMethodRow,
  type ShiftSummaryRow,
  type ProductSaleRow,
} from './daily-summary';

export {
  getDonationReport,
  type DonationReportParams,
  type DonationReportResult,
  type DonationDayRow,
} from './donations';

export {
  getHourlySales,
  type HourlySalesParams,
  type HourlySalesResult,
  type HourlyCell,
  type ChannelHourRow,
  type DayHourRow,
} from './hourly-sales';

export {
  getOmzetHarian,
  saveOmzetAdjustment,
  exportOmzetHarianXlsx,
  type OmzetHarianResult,
} from './daily-omzet';

export {
  getOmzetBulanan,
  exportOmzetBulananXlsx,
  type OmzetBulananResult,
  type OmzetBulananRow,
} from './pb1-monthly';

// T-0174 — F&B BI gaps.
export {
  aging,
  type AgingInput,
  type AgingKind,
  type AgingBuckets,
  type AgingPartnerRow,
  type AgingLineDetail,
  type AgingResult,
} from './aging';

export {
  cogsReport,
  type CogsInput,
  type CogsLine,
  type CogsRow,
  type CogsResult,
} from './cogs';

export {
  wasteReport,
  type WasteInput,
  type WasteRow,
  type WasteResult,
} from './waste';

export {
  periodCompare,
  previousPeriod,
  type PeriodInput,
  type PeriodCompareResult,
} from './period-compare';
