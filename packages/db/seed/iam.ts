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
  {
    code: 'MLI',
    name: n(
      'Aroadri Tea Malioboro Mall',
      'Aroadri Tea Malioboro Mall',
      'Aroadri Tea Malioboro Mall',
    ),
    type: 'store' as const,
    address:
      'Malioboro Mall, Jl. Mataram No. 31, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213',
  },
  {
    code: 'PLZ',
    name: n(
      'Aroadri Tea Plaza Malioboro',
      'Aroadri Tea Plaza Malioboro',
      'Aroadri Tea Plaza Malioboro',
    ),
    type: 'store' as const,
    address:
      'Plaza Malioboro, Jl. Malioboro No. 52-58, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213',
  },
  {
    code: 'YOG-OFC',
    name: n('Kantor Yogyakarta', 'Yogyakarta Office', '日惹办公室'),
    type: 'office' as const,
    address: 'Yogyakarta, Daerah Istimewa Yogyakarta',
  },
  {
    code: 'JKT-OFC',
    name: n('Kantor Jakarta', 'Jakarta Office', '雅加达办公室'),
    type: 'office' as const,
    address: 'Jakarta, Indonesia',
  },
];

export const LEGACY_INACTIVE_LOCATION_CODES = ['JKT', 'YOG'];

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
  // System wildcard. Granted only to director/vice_director through DB role mapping,
  // so future module permissions do not lock the bootstrap admin out.
  { code: '*.*', module: 'system' },
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
  { code: 'accounting.petty_cash.view', module: 'accounting' },
  { code: 'accounting.petty_cash.expense', module: 'accounting' },
  { code: 'accounting.petty_cash.replenish', module: 'accounting' },
  { code: 'accounting.petty_cash.manage', module: 'accounting' },
  { code: 'accounting.reimbursement.create', module: 'accounting' },
  { code: 'accounting.reimbursement.approve', module: 'accounting' },
  { code: 'accounting.reimbursement.disburse', module: 'accounting' },
  { code: 'accounting.reimbursement.view', module: 'accounting' },
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
  // Promotion
  { code: 'promotion.view', module: 'promotion' },
  { code: 'promotion.manage', module: 'promotion' },
  // Inventory
  { code: 'inventory.view', module: 'inventory' },
  { code: 'inventory.product.read', module: 'inventory' },
  { code: 'inventory.product.create', module: 'inventory' },
  { code: 'inventory.product.update', module: 'inventory' },
  { code: 'inventory.category.read', module: 'inventory' },
  { code: 'inventory.category.create', module: 'inventory' },
  { code: 'inventory.category.update', module: 'inventory' },
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
  { code: 'hr.employee.read', module: 'hr' },
  { code: 'hr.employee.write', module: 'hr' },
  { code: 'hr.manage_employees', module: 'hr' },
  { code: 'hr.manage_attendance', module: 'hr' },
  { code: 'hr.approve_leave', module: 'hr' },
  { code: 'hr.disciplinary.read', module: 'hr' },
  { code: 'hr.disciplinary.write', module: 'hr' },
  // Payroll
  { code: 'hr.payroll.write', module: 'payroll' },
  { code: 'hr.payroll.approve', module: 'payroll' },
  // CRM
  { code: 'crm.view', module: 'crm' },
  { code: 'crm.manage_members', module: 'crm' },
  { code: 'crm.logComplaint', module: 'crm' },
  { code: 'crm.listComplaints', module: 'crm' },
  { code: 'crm.resolveComplaint', module: 'crm' },
  { code: 'crm.awardCompensation', module: 'crm' },
  // Member (public-facing — no session required)
  { code: 'member.signup', module: 'member' },
  // Custom Fields
  { code: 'settings.manage', module: 'settings' },
  // Workflow
  { code: 'workflow.approve', module: 'workflow' },
  { code: 'workflow.view', module: 'workflow' },
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
    'accounting.view',
    'accounting.reports',
    'accounting.petty_cash.view',
    'accounting.petty_cash.expense',
    'accounting.petty_cash.replenish',
    'accounting.reimbursement.view',
    'accounting.reimbursement.create',
    'pos.transact',
    'pos.void',
    'pos.refund',
    'pos.demo.use',
    'pos.shift.open',
    'pos.shift.close',
    'promotion.view',
    'inventory.view',
    'inventory.product.read',
    'inventory.product.create',
    'inventory.product.update',
    'inventory.category.read',
    'inventory.category.create',
    'inventory.category.update',
    'inventory.adjust',
    'inventory.transfer',
    'purchasing.view',
    'purchasing.po.create',
    'purchasing.grn.create',
    'hr.view',
    'hr.employee.read',
    'hr.employee.write',
    'hr.manage_attendance',
    'hr.disciplinary.read',
    'hr.disciplinary.write',
    'kitchen.view',
    'reporting.view',
    'reporting.export',
    'audit.view',
    'crm.view',
    'crm.logComplaint',
    'crm.listComplaints',
    'crm.resolveComplaint',
    'workflow.approve',
    'workflow.view',
  ],
  accountant: [
    'accounting.view',
    'accounting.journal.create',
    'accounting.journal.post',
    'accounting.journal.reverse',
    'accounting.period.open',
    'accounting.period.close',
    'accounting.coa.manage',
    'accounting.reports',
    'accounting.petty_cash.view',
    'accounting.petty_cash.expense',
    'accounting.petty_cash.replenish',
    'accounting.petty_cash.manage',
    'accounting.reimbursement.view',
    'accounting.reimbursement.create',
    'accounting.reimbursement.approve',
    'accounting.reimbursement.disburse',
    'tax.view',
    'tax.export',
    'hr.view',
    'hr.employee.read',
    'hr.disciplinary.read',
    'reporting.view',
    'reporting.export',
    'audit.view',
  ],
  store_manager: [
    'pos.transact',
    'pos.void',
    'pos.refund',
    'pos.demo.use',
    'pos.shift.open',
    'pos.shift.close',
    'promotion.view',
    'inventory.view',
    'inventory.product.read',
    'inventory.product.create',
    'inventory.product.update',
    'inventory.category.read',
    'inventory.category.create',
    'inventory.category.update',
    'inventory.adjust',
    'accounting.petty_cash.view',
    'accounting.petty_cash.expense',
    'accounting.reimbursement.view',
    'accounting.reimbursement.create',
    'hr.view',
    'hr.employee.read',
    'hr.manage_attendance',
    'hr.disciplinary.read',
    'hr.disciplinary.write',
    'kitchen.view',
    'reporting.view',
  ],
  cashier: [
    'pos.transact',
    'pos.void',
    'pos.refund',
    'pos.demo.use',
    'pos.shift.open',
    'pos.shift.close',
    'promotion.view',
  ],
  assistant: [
    'accounting.view',
    'accounting.journal.create',
    'accounting.reports',
    'tax.view',
    'reporting.view',
  ],
};

// === BOOTSTRAP ADMIN USER DEFAULTS ===
// Password is intentionally not stored here. Set SEED_ADMIN_PASSWORD only for initial bootstrap.
export const DEV_ADMIN_USER = {
  email: 'admin@aroadritea.com',
  displayName: 'Admin Dev',
  locale: 'id' as const,
  status: 'active' as const,
  roleCode: 'director', // full access
};
