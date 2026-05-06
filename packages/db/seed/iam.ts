/**
 * IAM Seed — default tenant, locations, roles, permissions
 * SOURCE-OF-TRUTH §3.2, §15.1
 */

import type { LocaleString } from '@erp/shared/types';

const n = (id: string, en: string, zh: string): LocaleString => ({ id, en, zh });

// === TENANT ===
export const DEFAULT_TENANT = {
  id: 'default',
  name: 'PT Gandha Hill Catering Management Indonesia',
  localeDefault: 'id',
};

// === LOCATIONS — SoT §15.1 ===
export const LOCATIONS_SEED = [
  { code: 'MLI', name: n('Toko Malioboro', 'Malioboro Store', '马里奥波罗店'), type: 'store' as const, address: 'Malioboro Mall, Yogyakarta' },
  { code: 'PLZ', name: n('Toko Plaza Malioboro', 'Plaza Malioboro Store', '广场马里奥波罗店'), type: 'store' as const, address: 'Plaza Malioboro, Yogyakarta' },
  { code: 'JKT', name: n('Kantor Jakarta', 'Jakarta Office', '雅加达办公室'), type: 'office' as const, address: 'Jakarta' },
  { code: 'YOG', name: n('Kantor Yogyakarta', 'Yogyakarta Office', '日惹办公室'), type: 'office' as const, address: 'Yogyakarta' },
];

// === ROLES — SoT §3.2 ===
export const ROLES_SEED = [
  { code: 'director', name: n('Direktur', 'Director', '总监') },
  { code: 'vice_director', name: n('Wakil Direktur', 'Vice Director', '副总监') },
  { code: 'management', name: n('Manajemen', 'Management', '管理层') },
  { code: 'accountant', name: n('Akuntan / Keuangan', 'Accountant / Finance', '会计/财务') },
  { code: 'store_manager', name: n('Kepala Toko', 'Store Manager', '店长') },
  { code: 'cashier', name: n('Kasir', 'Cashier', '收银员') },
  { code: 'assistant', name: n('Asisten', 'Assistant', '助理') },
];

// === PERMISSIONS — grouped by module ===
export const PERMISSIONS_SEED = [
  // IAM
  { code: 'iam.manage_users', module: 'iam' },
  { code: 'iam.manage_roles', module: 'iam' },
  { code: 'iam.manage_permissions', module: 'iam' },
  { code: 'iam.manage_locations', module: 'iam' },
  // Accounting
  { code: 'accounting.view', module: 'accounting' },
  { code: 'accounting.journal.create', module: 'accounting' },
  { code: 'accounting.journal.post', module: 'accounting' },
  { code: 'accounting.journal.reverse', module: 'accounting' },
  { code: 'accounting.period.open', module: 'accounting' },
  { code: 'accounting.period.close', module: 'accounting' },
  { code: 'accounting.coa.manage', module: 'accounting' },
  { code: 'accounting.reports', module: 'accounting' },
  // Tax
  { code: 'tax.view', module: 'tax' },
  { code: 'tax.manage_rates', module: 'tax' },
  { code: 'tax.export', module: 'tax' },
  // POS
  { code: 'pos.transact', module: 'pos' },
  { code: 'pos.void', module: 'pos' },
  { code: 'pos.refund', module: 'pos' },
  { code: 'pos.demo.use', module: 'pos' },
  { code: 'pos.shift.open', module: 'pos' },
  { code: 'pos.shift.close', module: 'pos' },
  // Inventory
  { code: 'inventory.view', module: 'inventory' },
  { code: 'inventory.adjust', module: 'inventory' },
  { code: 'inventory.transfer', module: 'inventory' },
  { code: 'inventory.writeoff', module: 'inventory' },
  // Purchasing
  { code: 'purchasing.view', module: 'purchasing' },
  { code: 'purchasing.po.create', module: 'purchasing' },
  { code: 'purchasing.po.approve', module: 'purchasing' },
  { code: 'purchasing.grn.create', module: 'purchasing' },
  // HR
  { code: 'hr.view', module: 'hr' },
  { code: 'hr.manage_employees', module: 'hr' },
  { code: 'hr.manage_attendance', module: 'hr' },
  { code: 'hr.approve_leave', module: 'hr' },
  // Payroll
  { code: 'payroll.view', module: 'payroll' },
  { code: 'payroll.process', module: 'payroll' },
  // CRM
  { code: 'crm.view', module: 'crm' },
  { code: 'crm.manage_members', module: 'crm' },
  // Kitchen
  { code: 'kitchen.view', module: 'kitchen' },
  // Reporting
  { code: 'reporting.view', module: 'reporting' },
  { code: 'reporting.export', module: 'reporting' },
  // Audit
  { code: 'audit.view', module: 'audit' },
  // CMS
  { code: 'cms.manage', module: 'cms' },
];

// === ROLE → PERMISSION MAPPING (SoT §3.2 + §3.4) ===
export const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  director: PERMISSIONS_SEED.map((p) => p.code), // all permissions
  vice_director: PERMISSIONS_SEED.map((p) => p.code), // all permissions (delegated from director)
  management: [
    'accounting.view', 'accounting.reports', 'tax.view', 'tax.export',
    'pos.transact', 'pos.void', 'pos.refund', 'pos.demo.use', 'pos.shift.open', 'pos.shift.close',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'purchasing.view', 'purchasing.po.create', 'purchasing.grn.create',
    'hr.view', 'hr.manage_attendance', 'kitchen.view',
    'reporting.view', 'reporting.export', 'audit.view',
  ],
  accountant: [
    'accounting.view', 'accounting.journal.create', 'accounting.journal.post', 'accounting.journal.reverse',
    'accounting.period.open', 'accounting.period.close', 'accounting.coa.manage', 'accounting.reports',
    'tax.view', 'tax.export', 'reporting.view', 'reporting.export', 'audit.view',
  ],
  store_manager: [
    'pos.transact', 'pos.void', 'pos.refund', 'pos.demo.use', 'pos.shift.open', 'pos.shift.close',
    'inventory.view', 'inventory.adjust',
    'kitchen.view', 'reporting.view',
  ],
  cashier: [
    'pos.transact', 'pos.void', 'pos.refund', 'pos.demo.use', 'pos.shift.open', 'pos.shift.close',
  ],
  assistant: [
    'accounting.view', 'accounting.journal.create', 'accounting.reports',
    'tax.view', 'reporting.view',
  ],
};
