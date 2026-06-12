/**
 * Page ↔ permission mapping for the dashboard navigation.
 *
 * Single source of truth that mirrors the access gates the sidebar
 * (`apps/web/app/(dash)/sidebar.tsx`) uses to show/hide each menu entry. The
 * Permissions screen consumes this to answer the operator's question: "which
 * permission do I grant to unlock page X?" — both as a per-permission "unlocks"
 * hint and as a reverse Page → Permission reference table.
 *
 * Keep this in sync with the sidebar's NAV_ITEMS + PATH_TO_MODULE. `labelKey`
 * and `sectionKey` are keys under the `nav` i18n namespace (already used by the
 * sidebar). `gate` is the permission code (or permission prefix) that reveals
 * the page — identical to what the sidebar checks via `hasModuleAccess`.
 *
 * Always-visible self-service pages (dashboard, /account, my-schedule, check-in,
 * my-attendance, my-payslips, whistleblower form) are intentionally omitted —
 * they require no permission, so they have no place in a "what unlocks this" map.
 */

export interface NavAccessEntry {
  /** Route the menu entry links to. */
  href: string;
  /** i18n key under `nav` for the page label. */
  labelKey: string;
  /** i18n key under `nav` for the top-level menu section the page lives under. */
  sectionKey: string;
  /** Permission code/prefix that unlocks the page (mirrors the sidebar gate). */
  gate: string;
}

export const NAV_ACCESS: NavAccessEntry[] = [
  // CMS
  { href: '/cms/docs', labelKey: 'docsSettings', sectionKey: 'cms', gate: 'cms' },
  { href: '/cms/pages', labelKey: 'pages', sectionKey: 'cms', gate: 'cms' },
  { href: '/cms/posts', labelKey: 'posts', sectionKey: 'cms', gate: 'cms' },

  // Docs (operations manual)
  { href: '/docs', labelKey: 'docs', sectionKey: 'docs', gate: 'docs' },

  // Correspondence
  {
    href: '/correspondence',
    labelKey: 'correspondence',
    sectionKey: 'correspondence',
    gate: 'correspondence',
  },

  // Accounting
  {
    href: '/accounting/coa',
    labelKey: 'coa',
    sectionKey: 'accounting',
    gate: 'accounting.coa.manage',
  },
  {
    href: '/accounting/journals',
    labelKey: 'journals',
    sectionKey: 'accounting',
    gate: 'accounting.journal.create',
  },
  {
    href: '/accounting/invoices',
    labelKey: 'invoices',
    sectionKey: 'accounting',
    gate: 'accounting.view',
  },
  {
    href: '/accounting/partners',
    labelKey: 'partners',
    sectionKey: 'accounting',
    gate: 'accounting.view',
  },
  {
    href: '/correspondence?classification=finance&direction=internal',
    labelKey: 'accountingEvidence',
    sectionKey: 'accounting',
    gate: 'correspondence.view',
  },
  {
    href: '/accounting/assets',
    labelKey: 'fixedAssets',
    sectionKey: 'accounting',
    gate: 'accounting.fixed_asset.view',
  },
  {
    href: '/accounting/payables',
    labelKey: 'payables',
    sectionKey: 'accounting',
    gate: 'accounting.view',
  },
  {
    href: '/accounting/receivables',
    labelKey: 'receivables',
    sectionKey: 'accounting',
    gate: 'accounting.view',
  },
  {
    href: '/accounting/periods',
    labelKey: 'periods',
    sectionKey: 'accounting',
    gate: 'accounting.period.open',
  },
  {
    href: '/accounting/close-center',
    labelKey: 'financialClose',
    sectionKey: 'accounting',
    gate: 'accounting.view',
  },
  {
    href: '/accounting/petty-cash',
    labelKey: 'pettyCash',
    sectionKey: 'accounting',
    gate: 'accounting.petty_cash.view',
  },
  {
    href: '/accounting/reimbursement',
    labelKey: 'reimbursement',
    sectionKey: 'accounting',
    gate: 'accounting.reimbursement.view',
  },
  {
    href: '/accounting/bank-recon',
    labelKey: 'bankReconciliation',
    sectionKey: 'accounting',
    gate: 'accounting.bank_recon.view',
  },

  // Reporting
  {
    href: '/reporting/business-intelligence',
    labelKey: 'businessIntelligence',
    sectionKey: 'reporting',
    gate: 'reporting.view',
  },
  {
    href: '/reporting/trial-balance',
    labelKey: 'trialBalance',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/balance-sheet',
    labelKey: 'balanceSheet',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/profit-loss',
    labelKey: 'profitLoss',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/cash-flow',
    labelKey: 'cashFlow',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/equity-changes',
    labelKey: 'equityChanges',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/general-ledger',
    labelKey: 'generalLedger',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/aging-receivables',
    labelKey: 'agingReceivables',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/aging-payables',
    labelKey: 'agingPayables',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  {
    href: '/reporting/cogs',
    labelKey: 'cogs',
    sectionKey: 'reporting',
    gate: 'accounting.reports',
  },
  { href: '/reporting/waste', labelKey: 'waste', sectionKey: 'reporting', gate: 'reporting.view' },
  {
    href: '/reporting/daily-summary',
    labelKey: 'dailySummary',
    sectionKey: 'reporting',
    gate: 'reporting.view',
  },
  {
    href: '/reporting/hourly-sales',
    labelKey: 'hourlySales',
    sectionKey: 'reporting',
    gate: 'reporting.view',
  },
  {
    href: '/reporting/donations',
    labelKey: 'donations',
    sectionKey: 'reporting',
    gate: 'reporting.view',
  },
  {
    href: '/reporting/omzet-harian',
    labelKey: 'dailyRevenue',
    sectionKey: 'reporting',
    gate: 'reporting.view',
  },

  // POS
  { href: '/pos', labelKey: 'posCashier', sectionKey: 'pos', gate: 'pos.view' },
  { href: '/pos/manual-sales', labelKey: 'manualSales', sectionKey: 'pos', gate: 'pos.transact' },
  {
    href: '/pos/manual-sales/consumed',
    labelKey: 'consumedIngredients',
    sectionKey: 'pos',
    gate: 'pos.transact',
  },
  { href: '/pos/orders', labelKey: 'posOrders', sectionKey: 'pos', gate: 'pos.view' },
  { href: '/pos/demo', labelKey: 'demoMode', sectionKey: 'pos', gate: 'pos.demo.use' },

  // Kitchen (KDS)
  { href: '/kitchen', labelKey: 'kitchen', sectionKey: 'kitchen', gate: 'kitchen.view' },

  // Inventory
  {
    href: '/inventory/products',
    labelKey: 'productsMenu',
    sectionKey: 'inventory',
    gate: 'inventory.product',
  },
  {
    href: '/inventory/supplies',
    labelKey: 'supplies',
    sectionKey: 'inventory',
    gate: 'inventory.product',
  },
  {
    href: '/inventory/categories',
    labelKey: 'categories',
    sectionKey: 'inventory',
    gate: 'inventory.category',
  },
  {
    href: '/inventory/uom-conversions',
    labelKey: 'uomConversions',
    sectionKey: 'inventory',
    gate: 'inventory.product',
  },
  {
    href: '/inventory/stock',
    labelKey: 'stockByOutlet',
    sectionKey: 'inventory',
    gate: 'inventory.view',
  },
  {
    href: '/inventory/transfer',
    labelKey: 'stockTransfer',
    sectionKey: 'inventory',
    gate: 'inventory.transfer',
  },
  {
    href: '/inventory/recipes',
    labelKey: 'recipes',
    sectionKey: 'inventory',
    gate: 'inventory.recipe',
  },
  {
    href: '/inventory/opname',
    labelKey: 'stockOpname',
    sectionKey: 'inventory',
    gate: 'inventory.opname',
  },
  {
    href: '/inventory/variance',
    labelKey: 'inventoryVariance',
    sectionKey: 'inventory',
    gate: 'inventory.view',
  },
  {
    href: '/inventory/stock-ledger',
    labelKey: 'stockLedger',
    sectionKey: 'inventory',
    gate: 'inventory.view',
  },

  // Purchasing
  {
    href: '/purchasing',
    labelKey: 'purchaseOrders',
    sectionKey: 'purchasing',
    gate: 'purchasing.view',
  },
  {
    href: '/purchasing/po/new',
    labelKey: 'newPo',
    sectionKey: 'purchasing',
    gate: 'purchasing.po.create',
  },
  {
    href: '/purchasing/grn-report',
    labelKey: 'grnReport',
    sectionKey: 'purchasing',
    gate: 'purchasing.view',
  },
  {
    href: '/purchasing/returns',
    labelKey: 'purchaseReturns',
    sectionKey: 'purchasing',
    gate: 'purchasing.return',
  },
  {
    href: '/purchasing/shipments',
    labelKey: 'shipments',
    sectionKey: 'purchasing',
    gate: 'purchasing.view',
  },

  // Logistics
  {
    href: '/logistics/outgoing-shipments',
    labelKey: 'outgoingShipments',
    sectionKey: 'logistics',
    gate: 'logistics.shipments.view',
  },

  // Tax
  { href: '/tax/rates', labelKey: 'taxRates', sectionKey: 'tax', gate: 'tax.manage_rates' },
  { href: '/tax/rules', labelKey: 'taxRules', sectionKey: 'tax', gate: 'tax.manage_global_rates' },
  { href: '/tax/efaktur', labelKey: 'taxEfaktur', sectionKey: 'tax', gate: 'tax.export' },
  { href: '/tax/spt', labelKey: 'taxSpt', sectionKey: 'tax', gate: 'tax.view' },
  { href: '/tax/bupot', labelKey: 'taxBupot', sectionKey: 'tax', gate: 'tax.view' },
  { href: '/tax/pb1-monthly', labelKey: 'taxPb1Monthly', sectionKey: 'tax', gate: 'tax.view' },

  // HR & Payroll
  { href: '/hr/employees', labelKey: 'employees', sectionKey: 'hrPayroll', gate: 'hr.employee' },
  {
    href: '/hr/recruitment',
    labelKey: 'recruitment',
    sectionKey: 'hrPayroll',
    gate: 'hr.recruitment',
  },
  {
    href: '/hr/schedule',
    labelKey: 'schedule',
    sectionKey: 'hrPayroll',
    gate: 'hr.manage_attendance',
  },
  {
    href: '/hr/schedule/shifts',
    labelKey: 'masterShifts',
    sectionKey: 'hrPayroll',
    gate: 'hr.manage_attendance',
  },
  {
    href: '/hr/attendance',
    labelKey: 'attendance',
    sectionKey: 'hrPayroll',
    gate: 'hr.attendance',
  },
  { href: '/hr/leave', labelKey: 'leave', sectionKey: 'hrPayroll', gate: 'hr.approve_leave' },
  { href: '/hr/kasbon', labelKey: 'kasbon', sectionKey: 'hrPayroll', gate: 'hr.payroll' },
  {
    href: '/hr/overtime',
    labelKey: 'overtime',
    sectionKey: 'hrPayroll',
    gate: 'hr.manage_attendance',
  },
  { href: '/hr/payroll', labelKey: 'payroll', sectionKey: 'hrPayroll', gate: 'hr.payroll' },
  {
    href: '/hr/disciplinary',
    labelKey: 'disciplinary',
    sectionKey: 'hrPayroll',
    gate: 'hr.disciplinary',
  },
  { href: '/hr/sop', labelKey: 'sop', sectionKey: 'hrPayroll', gate: 'hr.sop' },
  {
    href: '/hr/whistleblower',
    labelKey: 'whistleblowerReports',
    sectionKey: 'hrPayroll',
    gate: 'hr.whistleblower',
  },

  // Helpdesk
  { href: '/helpdesk', labelKey: 'helpdesk', sectionKey: 'helpdesk', gate: 'helpdesk' },

  // CRM
  { href: '/crm/members', labelKey: 'members', sectionKey: 'crm', gate: 'crm.member' },

  // AI assistant
  {
    href: '/ai-assistant',
    labelKey: 'aiAssistant',
    sectionKey: 'aiAssistant',
    gate: 'ai.assistant.use',
  },

  // Settings
  { href: '/audit', labelKey: 'auditTrail', sectionKey: 'settings', gate: 'audit' },
  {
    href: '/settings/locations',
    labelKey: 'locations',
    sectionKey: 'settings',
    gate: 'iam.manage_locations',
  },
  {
    href: '/settings/pos',
    labelKey: 'posSettings',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/promotions',
    labelKey: 'promotions',
    sectionKey: 'settings',
    gate: 'promotion.manage',
  },
  {
    href: '/settings/loyalty',
    labelKey: 'loyalty',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/attendance',
    labelKey: 'attendancePolicy',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/scheduled-jobs',
    labelKey: 'scheduledJobs',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/notifications',
    labelKey: 'notifications',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/integrations/naixer',
    labelKey: 'naixerKds',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/permissions',
    labelKey: 'permissions',
    sectionKey: 'settings',
    gate: 'iam.manage_permissions',
  },
  {
    href: '/settings/mcp-tokens',
    labelKey: 'mcpTokens',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/custom-fields',
    labelKey: 'customFields',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/company',
    labelKey: 'companySettings',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/accounting',
    labelKey: 'accountingSettings',
    sectionKey: 'settings',
    gate: 'settings.manage',
  },
  {
    href: '/settings/bank-accounts',
    labelKey: 'bankAccounts',
    sectionKey: 'settings',
    gate: 'settings.bank_accounts',
  },
  {
    href: '/settings/workflow-editor',
    labelKey: 'workflowEditor',
    sectionKey: 'settings',
    gate: 'workflow.view',
  },
  {
    href: '/settings/ai-assistant',
    labelKey: 'aiAssistantSettings',
    sectionKey: 'settings',
    gate: 'ai.assistant.admin',
  },
  {
    href: '/settings/ai-assistant/log',
    labelKey: 'aiAssistantLog',
    sectionKey: 'settings',
    gate: 'ai.assistant.admin',
  },
];

/**
 * True when holding the single permission `granted` is enough to unlock a page
 * whose gate is `gate`. Mirrors the sidebar's `hasModuleAccess` semantics for a
 * single granted code: super-wildcard, exact match, parent wildcard
 * (`module.*`), or descendant (granted is a more specific code under the gate).
 */
export function permissionMatchesGate(granted: string, gate: string): boolean {
  if (!gate) return true;
  if (granted === '*.*') return true;
  if (granted === gate) return true;

  // Parent wildcard: e.g. granted `accounting.*` covers gate `accounting.view`.
  const parts = gate.split('.');
  let current = '';
  for (const part of parts) {
    current += current ? `.${part}` : part;
    if (granted === `${current}.*`) return true;
  }

  // Descendant: gate is a prefix, granted is a concrete code beneath it
  // e.g. gate `inventory.product`, granted `inventory.product.read`.
  return granted.startsWith(`${gate}.`);
}

/** Pages unlocked by holding exactly the permission `code`. */
export function pagesForPermission(code: string): NavAccessEntry[] {
  if (code === '*.*') return NAV_ACCESS;
  return NAV_ACCESS.filter((entry) => permissionMatchesGate(code, entry.gate));
}

/**
 * Given the catalog of available permission codes, returns the subset that
 * unlocks the page with gate `gate` (excluding the system wildcard `*.*`, which
 * trivially unlocks everything and would just add noise).
 */
export function permissionsForGate(gate: string, allCodes: string[]): string[] {
  return allCodes.filter((code) => code !== '*.*' && permissionMatchesGate(code, gate));
}
