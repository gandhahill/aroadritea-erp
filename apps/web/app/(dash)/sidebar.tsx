/**
 * Dashboard sidebar navigation — SD §21.1
 * Module-based navigation for the ERP dashboard.
 * Uses brand tokens per ADR-0006.
 */

'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (navRef.current) {
      setTimeout(() => {
        const activeEl = navRef.current?.querySelector('[data-active="true"]');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }, [pathname, isCollapsed]);

  const NAV_ITEMS: NavItem[] = [
    {
      label: t('dashboard'),
      href: '/dashboard',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12 12 2.25 21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
          />
        </svg>
      ),
    },
    {
      label: t('cms'),
      href: '/cms',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      ),
      children: [
        { label: t('docsSettings'), href: '/cms/docs', icon: <></> },
        { label: t('pages'), href: '/cms/pages', icon: <></> },
        { label: t('posts'), href: '/cms/posts', icon: <></> },
      ],
    },
    {
      label: t('docs'),
      href: '/docs',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-7.5A2.25 2.25 0 0 0 17.25 4.5H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5A2.25 2.25 0 0 0 6.75 19.5h7.5m5.25-5.25-5.25 5.25m5.25-5.25h-3.75a1.5 1.5 0 0 0-1.5 1.5v3.75"
          />
        </svg>
      ),
    },
    {
      label: t('correspondence'),
      href: '/correspondence',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5A2.25 2.25 0 0 1 19.5 19.5h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0l-7.5-4.615a2.25 2.25 0 0 1-1.07-1.916V6.75"
          />
        </svg>
      ),
    },
    {
      label: t('accounting'),
      href: '/accounting',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
          />
        </svg>
      ),
      children: [
        { label: t('coa'), href: '/accounting/coa', icon: <></> },
        { label: t('journals'), href: '/accounting/journals', icon: <></> },
        { label: t('invoices'), href: '/accounting/invoices', icon: <></> },
        {
          label: t('accountingEvidence'),
          href: '/correspondence?classification=finance&direction=internal',
          icon: <></>,
        },
        { label: t('fixedAssets'), href: '/accounting/assets', icon: <></> },
        { label: t('payables'), href: '/accounting/payables', icon: <></> },
        { label: t('receivables'), href: '/accounting/receivables', icon: <></> },
        { label: t('periods'), href: '/accounting/periods', icon: <></> },
        { label: t('pettyCash'), href: '/accounting/petty-cash', icon: <></> },
        { label: t('reimbursement'), href: '/accounting/reimbursement', icon: <></> },
        { label: t('bankReconciliation'), href: '/accounting/bank-recon', icon: <></> },
      ],
    },
    {
      label: t('reporting'),
      href: '/reporting',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          />
        </svg>
      ),
      children: [
        { label: t('businessIntelligence'), href: '/reporting/business-intelligence', icon: <></> },
        { label: t('trialBalance'), href: '/reporting/trial-balance', icon: <></> },
        { label: t('balanceSheet'), href: '/reporting/balance-sheet', icon: <></> },
        { label: t('profitLoss'), href: '/reporting/profit-loss', icon: <></> },
        { label: t('cashFlow'), href: '/reporting/cash-flow', icon: <></> },
        { label: t('agingReceivables'), href: '/reporting/aging-receivables', icon: <></> },
        { label: t('agingPayables'), href: '/reporting/aging-payables', icon: <></> },
        { label: t('cogs'), href: '/reporting/cogs', icon: <></> },
        { label: t('waste'), href: '/reporting/waste', icon: <></> },
        { label: t('dailySummary'), href: '/reporting/daily-summary', icon: <></> },
        { label: t('hourlySales'), href: '/reporting/hourly-sales', icon: <></> },
        { label: t('donations'), href: '/reporting/donations', icon: <></> },
        { label: t('dailyRevenue'), href: '/reporting/omzet-harian', icon: <></> },
      ],
    },
    {
      label: t('pos'),
      href: '/pos',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3m-3 6.75h3m-3 0h3M9.75 9h3m0 0h3M4.5 9h3m0 0h3M4.5 15h3m0 0h3m0 0h3M9 9h3m0 0h3m0 0h3M9 15h3m0 0h3M9 12h3m0 0h3m0 0h3M9 18h3m0 0h3m0 0h3"
          />
        </svg>
      ),
      children: [
        { label: t('posCashier'), href: '/pos', icon: <></> },
        { label: t('manualSales'), href: '/pos/manual-sales', icon: <></> },
        { label: t('consumedIngredients'), href: '/pos/manual-sales/consumed', icon: <></> },
        { label: t('posOrders'), href: '/pos/orders', icon: <></> },
        { label: t('demoMode'), href: '/pos/demo', icon: <></> },
      ],
    },
    {
      label: t('inventory'),
      href: '/inventory',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
          />
        </svg>
      ),
      children: [
        { label: t('productsMenu'), href: '/inventory/products', icon: <></> },
        { label: t('supplies'), href: '/inventory/supplies', icon: <></> },
        { label: t('categories'), href: '/inventory/categories', icon: <></> },
        { label: t('stockByOutlet'), href: '/inventory/stock', icon: <></> },
        { label: t('stockTransfer'), href: '/inventory/transfer', icon: <></> },
        { label: t('recipes'), href: '/inventory/recipes', icon: <></> },
        { label: t('stockOpname'), href: '/inventory/opname', icon: <></> },
        { label: t('inventoryVariance'), href: '/inventory/variance', icon: <></> },
      ],
    },
    {
      label: t('purchasing'),
      href: '/purchasing',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h9.75a3 3 0 0 0 2.914-2.287l1.286-5.25A1.125 1.125 0 0 0 20.36 5.25H5.106m2.394 9L5.106 5.25M8.25 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm10.5 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
          />
        </svg>
      ),
      children: [
        { label: t('purchaseOrders'), href: '/purchasing', icon: <></> },
        { label: t('newPo'), href: '/purchasing/po/new', icon: <></> },
        { label: t('grnReport'), href: '/purchasing/grn-report', icon: <></> },
        { label: t('purchaseReturns'), href: '/purchasing/returns', icon: <></> },
        { label: t('shipments'), href: '/purchasing/shipments', icon: <></> },
      ],
    },
    {
      label: t('logistics'),
      href: '/logistics',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
          />
        </svg>
      ),
      children: [
        { label: t('outgoingShipments'), href: '/logistics/outgoing-shipments', icon: <></> },
      ],
    },
    {
      label: t('tax'),
      href: '/tax',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
          />
        </svg>
      ),
      children: [
        { label: t('taxRates'), href: '/tax/rates', icon: <></> },
        { label: t('taxRules'), href: '/tax/rules', icon: <></> },
      ],
    },
    {
      label: t('hrPayroll'),
      href: '/hr',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
          />
        </svg>
      ),
      children: [
        { label: t('employees'), href: '/hr/employees', icon: <></> },
        { label: t('recruitment'), href: '/hr/recruitment', icon: <></> },
        { label: t('schedule'), href: '/hr/schedule', icon: <></> },
        { label: t('checkIn'), href: '/hr/checkin', icon: <></> },
        { label: t('attendance'), href: '/hr/attendance', icon: <></> },
        { label: t('myAttendance'), href: '/hr/my-attendance', icon: <></> },
        { label: t('leave'), href: '/hr/leave', icon: <></> },
        { label: t('payroll'), href: '/hr/payroll', icon: <></> },
        { label: t('myPayslips'), href: '/hr/my-payslips', icon: <></> },
        { label: t('disciplinary'), href: '/hr/disciplinary', icon: <></> },
        { label: t('sop'), href: '/hr/sop', icon: <></> },
        { label: t('whistleblowerForm'), href: '/whistleblower', icon: <></> },
        { label: t('whistleblowerReports'), href: '/hr/whistleblower', icon: <></> },
      ],
    },
    {
      label: t('helpdesk'),
      href: '/helpdesk',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
          />
        </svg>
      ),
    },
    {
      label: t('crm'),
      href: '/crm/members',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
          />
        </svg>
      ),
      children: [{ label: t('members'), href: '/crm/members', icon: <></> }],
    },
    {
      label: t('aiAssistant'),
      href: '/ai-assistant',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.091ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
          />
        </svg>
      ),
    },
    {
      label: t('settings'),
      href: '/settings',
      icon: (
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      ),
      children: [
        { label: t('account'), href: '/account', icon: <></> },
        { label: t('auditTrail'), href: '/audit', icon: <></> },
        { label: t('locations'), href: '/settings/locations', icon: <></> },
        { label: t('posSettings'), href: '/settings/pos', icon: <></> },
        { label: t('promotions'), href: '/settings/promotions', icon: <></> },
        { label: t('loyalty'), href: '/settings/loyalty', icon: <></> },
        { label: t('attendancePolicy'), href: '/settings/attendance', icon: <></> },
        { label: t('scheduledJobs'), href: '/settings/scheduled-jobs', icon: <></> },
        { label: t('notifications'), href: '/settings/notifications', icon: <></> },
        { label: t('naixerKds'), href: '/settings/integrations/naixer', icon: <></> },
        { label: t('permissions'), href: '/settings/permissions', icon: <></> },
        { label: t('customFields'), href: '/settings/custom-fields', icon: <></> },
        { label: t('companySettings'), href: '/settings/company', icon: <></> },
        { label: t('accountingSettings'), href: '/settings/accounting', icon: <></> },
        { label: t('bankAccounts'), href: '/settings/bank-accounts', icon: <></> },
        { label: t('workflowEditor'), href: '/settings/workflow-editor', icon: <></> },
        { label: t('aiAssistantSettings'), href: '/settings/ai-assistant', icon: <></> },
        { label: t('aiAssistantLog'), href: '/settings/ai-assistant/log', icon: <></> },
      ],
    },
  ];

  const toggleSection = (href: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <aside
      className={`flex flex-col border-r border-brand-cream-3 bg-card transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-56'}`}
    >
      {/* Logo */}
      <div
        className={`flex h-14 items-center border-b border-brand-cream-3 px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src="/logo-primary.png"
            alt="Aroadri Tea"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0"
          />
          {!isCollapsed && (
            <span className="font-display text-base font-semibold text-brand-ink shrink-0">
              ERP
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`shrink-0 p-1 text-brand-ink-3 hover:text-brand-ink hover:bg-brand-cream-2 rounded-md transition-colors ${isCollapsed ? 'hidden' : 'block'}`}
          title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>
      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="mx-auto mt-2 p-1.5 text-brand-ink-3 hover:text-brand-ink hover:bg-brand-cream-2 rounded-md transition-colors"
          title={t('expandSidebar')}
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Nav */}
      <nav ref={navRef} className="flex-1 overflow-y-auto py-3 px-2 overflow-x-hidden">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isSectionCollapsed = collapsedSections.has(item.href);

            return (
              <li key={item.href}>
                {hasChildren && !isCollapsed ? (
                  <>
                    <button
                      type="button"
                      data-active={
                        isActive && !item.children?.some((c) => pathname === c.href)
                          ? 'true'
                          : undefined
                      }
                      onClick={() => toggleSection(item.href)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-red/10 text-brand-red'
                          : 'text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-ink'
                      }`}
                    >
                      <div className="shrink-0">{item.icon}</div>
                      <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
                      <svg
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 shrink-0 text-brand-ink-3 transition-transform duration-150 ${
                          !isSectionCollapsed ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </button>

                    {!isSectionCollapsed && (
                      <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-brand-cream-3 pl-3">
                        {item.children?.map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                data-active={childActive ? 'true' : undefined}
                                className={`block rounded-md px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                                  childActive
                                    ? 'bg-brand-red/10 font-medium text-brand-red'
                                    : 'text-brand-ink-3 hover:bg-brand-cream-2 hover:text-brand-ink'
                                }`}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    data-active={isActive ? 'true' : undefined}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-red/10 text-brand-red'
                        : 'text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-ink'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <div className="shrink-0">{item.icon}</div>
                    {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-brand-cream-3 px-4 py-3 whitespace-nowrap overflow-hidden transition-opacity ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}
      >
        <p className="brand-wordmark text-[10px] uppercase tracking-widest text-brand-ink-3">
          Aroadri Tea ERP
        </p>
      </div>
    </aside>
  );
}
