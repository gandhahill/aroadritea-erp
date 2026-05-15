/**
 * MCP Tool registry — re-exports all tool arrays and definitions.
 */

export {
  iamTools,
  ListLocationsSchema,
  WhoamiSchema,
} from './iam';

export {
  accountingTools,
  ListAccountsSchema,
  CreateJournalSchema,
  PostJournalSchema,
  ReverseJournalSchema,
  GetPeriodStatusSchema,
  ClosePeriodSchema,
  GetJournalWithAttachmentsSchema,
  ListJournalAttachmentsSchema,
} from './accounting';

export {
  taxTools,
  ListRatesSchema,
  ExportCoretaxSchema,
} from './tax';

export {
  reportingTools,
  BalanceSheetSchema,
  ProfitLossSchema,
  CashFlowSchema,
  GeneralLedgerSchema,
  TrialBalanceSchema,
  DailySummarySchema,
} from './reporting';

export {
  inventoryTools,
  InventoryListProductsSchema,
  InventoryGetStockSchema,
  InventoryAdjustSchema,
  purchasingTools,
  PurchasingCreatePOSchema,
  PurchasingApprovePOSchema,
  PurchasingCreateGRNSchema,
  posTools,
  POSListSalesSchema,
  POSRefundSchema,
  hrTools,
  HRCreateEmployeeSchema,
  HRListEmployeesSchema,
  payrollTools,
  PayrollRunSchema,
  PayrollApproveSchema,
  PayrollMarkPaidSchema,
  disciplinaryTools,
  DisciplinaryCreateSchema,
  DisciplinaryAcknowledgeSchema,
  DisciplinaryListSchema,
  crmTools,
  CRMCreateMemberSchema,
  CRMLogComplaintSchema,
  CRMListComplaintsSchema,
  CRMResolveComplaintSchema,
  memberTools,
  MemberGetLoyaltySchema,
  MemberGetVouchersSchema,
  MemberRedeemPointsSchema,
  promotionTools,
  PromotionListSchema,
  PromotionUpsertSchema,
  auditTools,
  AuditSearchSchema,
} from './phase2';
