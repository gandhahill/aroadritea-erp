/**
 * Standardize all page metadata titles to format: "Page Name | Aroadri ERP"
 * 
 * Run: node scripts/fix-page-titles.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', 'apps', 'web', 'app');

// Map of file path patterns → desired English title (before " | Aroadri ERP")
const TITLE_MAP = {
  // Dashboard
  '(dash)/dashboard/page.tsx': 'Dashboard',
  '(dash)/account/page.tsx': null, // uses generateMetadata, skip
  
  // Accounting
  '(dash)/accounting/journals/page.tsx': 'Journal Entries',
  '(dash)/accounting/journals/new/page.tsx': 'New Journal Entry',
  '(dash)/accounting/journals/[id]/page.tsx': 'Journal Detail',
  '(dash)/accounting/journals/[id]/print/page.tsx': 'Print Journal',
  '(dash)/accounting/coa/page.tsx': 'Chart of Accounts',
  '(dash)/accounting/coa/new/page.tsx': 'New Account',
  '(dash)/accounting/periods/page.tsx': 'Accounting Periods',
  '(dash)/accounting/bank-statements/page.tsx': 'Bank Statements',
  '(dash)/accounting/bank-reconciliation/page.tsx': 'Bank Reconciliation',
  '(dash)/accounting/invoices/page.tsx': 'Invoices',
  '(dash)/accounting/invoices/new/page.tsx': 'New Invoice',
  '(dash)/accounting/invoices/[id]/post/page.tsx': 'Post Invoice',
  '(dash)/accounting/fixed-assets/page.tsx': 'Fixed Assets',
  '(dash)/accounting/petty-cash/page.tsx': 'Petty Cash',
  '(dash)/accounting/reimbursement/page.tsx': 'Reimbursement',
  '(dash)/accounting/tax-rates/page.tsx': 'Tax Rates',
  '(dash)/accounting/tax-rules/page.tsx': 'Tax Rules',

  // Inventory
  '(dash)/inventory/products/page.tsx': 'Products',
  '(dash)/inventory/products/new/page.tsx': 'New Product',
  '(dash)/inventory/stock/page.tsx': 'Stock Levels',
  '(dash)/inventory/adjustments/page.tsx': 'Stock Adjustments',
  '(dash)/inventory/adjustments/new/page.tsx': 'New Adjustment',
  '(dash)/inventory/transfers/page.tsx': 'Stock Transfers',
  '(dash)/inventory/transfers/new/page.tsx': 'New Transfer',
  '(dash)/inventory/opname/page.tsx': 'Stock Opname',
  '(dash)/inventory/opname/new/page.tsx': 'New Stock Opname',
  '(dash)/inventory/variance/page.tsx': 'Inventory Variance',
  '(dash)/inventory/categories/page.tsx': 'Product Categories',
  '(dash)/inventory/modifiers/page.tsx': 'Modifier Groups',

  // Purchasing
  '(dash)/purchasing/orders/page.tsx': 'Purchase Orders',
  '(dash)/purchasing/orders/new/page.tsx': 'New Purchase Order',
  '(dash)/purchasing/grn/page.tsx': 'Goods Received Notes',
  '(dash)/purchasing/grn/new/page.tsx': 'New GRN',
  '(dash)/purchasing/invoices/page.tsx': 'Purchase Invoices',
  '(dash)/purchasing/invoices/new/page.tsx': 'New Purchase Invoice',
  '(dash)/purchasing/returns/page.tsx': 'Purchase Returns',
  '(dash)/purchasing/returns/new/page.tsx': 'New Purchase Return',
  '(dash)/purchasing/suppliers/page.tsx': 'Suppliers',

  // POS
  '(dash)/pos/page.tsx': 'Point of Sale',
  '(dash)/pos/orders/page.tsx': 'Order History',
  '(dash)/pos/manual-sales/page.tsx': 'Manual Sales Closing',
  '(dash)/pos/shifts/page.tsx': 'Shift Management',
  '(dash)/pos/refunds/page.tsx': 'Refunds',
  '(dash)/pos/refunds/new/page.tsx': 'New Refund',

  // HR
  '(dash)/hr/employees/page.tsx': 'Employees',
  '(dash)/hr/employees/new/page.tsx': 'New Employee',
  '(dash)/hr/attendance/page.tsx': 'Attendance',
  '(dash)/hr/checkin/page.tsx': 'Check In',
  '(dash)/hr/my-attendance/page.tsx': 'My Attendance',
  '(dash)/hr/payroll/page.tsx': 'Payroll',
  '(dash)/hr/leave/page.tsx': 'Leave Management',
  '(dash)/hr/schedule/page.tsx': 'Shift Schedule',
  '(dash)/hr/disciplinary/page.tsx': 'Disciplinary Actions',
  '(dash)/hr/recruitment/page.tsx': 'Recruitment',
  '(dash)/hr/my-leave/page.tsx': 'My Leave',
  '(dash)/hr/whistleblower/page.tsx': 'Whistleblower Reports',

  // CRM
  '(dash)/crm/members/page.tsx': 'Member Database',
  '(dash)/crm/complaints/page.tsx': 'Complaints',
  '(dash)/crm/correspondence/page.tsx': 'Correspondence',

  // Reporting
  '(dash)/reporting/aging-payables/page.tsx': 'Aging Payables',
  '(dash)/reporting/aging-receivables/page.tsx': 'Aging Receivables',
  '(dash)/reporting/cash-flow/page.tsx': 'Cash Flow',
  '(dash)/reporting/cogs/page.tsx': 'COGS & Recipe Costing',
  '(dash)/reporting/donations/page.tsx': 'Donation Report',
  '(dash)/reporting/hourly-sales/page.tsx': 'Hourly Sales',
  '(dash)/reporting/waste/page.tsx': 'Waste / Spoilage',
  '(dash)/reporting/bi/page.tsx': 'Business Intelligence',

  // Helpdesk
  '(dash)/helpdesk/page.tsx': 'Helpdesk',
  '(dash)/helpdesk/new/page.tsx': 'New Ticket',

  // Audit
  '(dash)/audit/page.tsx': null, // uses generateMetadata, skip

  // Notifications
  '(dash)/notifications/page.tsx': 'Notifications',

  // Logistics
  '(dash)/logistics/shipments/page.tsx': 'Outgoing Shipments',

  // Settings
  '(dash)/settings/locations/page.tsx': 'Locations',
  '(dash)/settings/pos/page.tsx': 'POS Settings',
  '(dash)/settings/promotions/page.tsx': 'Promotions',
  '(dash)/settings/loyalty/page.tsx': 'Loyalty Settings',
  '(dash)/settings/attendance/page.tsx': 'Attendance Policy',
  '(dash)/settings/scheduled-jobs/page.tsx': 'Scheduled Jobs',
  '(dash)/settings/notifications/page.tsx': 'Notification Channels',
  '(dash)/settings/integrations/naixer/page.tsx': 'Naixer KDS Integration',
  '(dash)/settings/permissions/page.tsx': 'Permissions',
  '(dash)/settings/custom-fields/page.tsx': 'Custom Fields',
  '(dash)/settings/company/page.tsx': 'Company Settings',
  '(dash)/settings/accounting/page.tsx': 'Accounting Settings',
  '(dash)/settings/bank-accounts/page.tsx': 'Bank Accounts',
  '(dash)/settings/workflow-editor/page.tsx': 'Workflow Editor',

  // Print pages
  '(print)/pos/print/demo-label/page.tsx': '[DEMO] Label',
  '(print)/pos/print/demo-receipt/page.tsx': '[DEMO] Receipt',
};

const SUFFIX = ' | Aroadri ERP';
let updatedCount = 0;
let skippedCount = 0;

for (const [relPath, desiredTitle] of Object.entries(TITLE_MAP)) {
  if (desiredTitle === null) {
    skippedCount++;
    continue;
  }

  const fullPath = path.join(webRoot, ...relPath.split('/'));
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    skippedCount++;
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const fullTitle = desiredTitle + SUFFIX;

  // Pattern 1: export const metadata: Metadata = { title: '...' };
  const metadataRegex = /(export\s+const\s+metadata[\s\S]*?title:\s*)['"](.*?)['"]/;
  // Pattern 2: export const metadata = { title: '...' };
  const metadataRegex2 = /(metadata\s*=\s*\{[^}]*?title:\s*)['"](.*?)['"]/;

  const match = content.match(metadataRegex) || content.match(metadataRegex2);
  
  if (match) {
    const oldTitle = match[2];
    if (oldTitle === fullTitle) {
      console.log(`OK (already correct): ${relPath}`);
      continue;
    }

    content = content.replace(match[0], `${match[1]}'${fullTitle}'`);
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`UPDATED: ${relPath}: "${oldTitle}" → "${fullTitle}"`);
    updatedCount++;
  } else {
    console.log(`SKIP (no static metadata.title): ${relPath}`);
    skippedCount++;
  }
}

console.log(`\nDone! Updated ${updatedCount} files, skipped ${skippedCount}`);
