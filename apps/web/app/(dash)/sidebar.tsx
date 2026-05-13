/**
 * Dashboard sidebar navigation — SD §21.1
 * Module-based navigation for the ERP dashboard.
 * Uses brand tokens per ADR-0006.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('pos');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const NAV_ITEMS: NavItem[] = [
    {
      label: 'CMS',
      href: '/cms',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
      children: [
        { label: 'Halaman', href: '/cms/pages', icon: <></> },
        { label: 'Post', href: '/cms/posts', icon: <></> },
      ],
    },
    {
      label: 'Accounting',
      href: '/accounting',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      children: [
        { label: 'Chart of Accounts', href: '/accounting/coa', icon: <></> },
        { label: 'Journal Entries', href: '/accounting/journals', icon: <></> },
        { label: 'Periods', href: '/accounting/periods', icon: <></> },
        { label: 'Petty Cash', href: '/accounting/petty-cash', icon: <></> },
        { label: 'Reimbursement', href: '/accounting/reimbursement', icon: <></> },
      ],
    },
    {
      label: 'Reporting',
      href: '/reporting',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
      children: [
        { label: 'Trial Balance', href: '/reporting/trial-balance', icon: <></> },
        { label: 'Balance Sheet', href: '/reporting/balance-sheet', icon: <></> },
        { label: 'Profit & Loss', href: '/reporting/profit-loss', icon: <></> },
        { label: 'Ringkasan Harian', href: '/reporting/daily-summary', icon: <></> },
        { label: 'Penjualan Per Jam', href: '/reporting/hourly-sales', icon: <></> },
        { label: 'Laporan Donasi', href: '/reporting/donations', icon: <></> },
      ],
    },
    {
      label: 'POS',
      href: '/pos',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3m-3 6.75h3m-3 0h3M9.75 9h3m0 0h3M4.5 9h3m0 0h3M4.5 15h3m0 0h3m0 0h3M9 9h3m0 0h3m0 0h3M9 15h3m0 0h3M9 12h3m0 0h3m0 0h3M9 18h3m0 0h3m0 0h3" />
        </svg>
      ),
      children: [
        { label: t('kasirPos'), href: '/pos', icon: <></> },
        { label: t('modeDemo'), href: '/pos/demo', icon: <></> },
      ],
    },
    {
      label: 'Inventory',
      href: '/inventory',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      ),
      children: [
        { label: 'Stock Opname', href: '/inventory/opname', icon: <></> },
        { label: 'Varians Persediaan', href: '/inventory/variance', icon: <></> },
      ],
    },
    {
      label: 'Tax',
      href: '/tax',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
      ),
      children: [
        { label: 'Tax Rates', href: '/tax/rates', icon: <></> },
        { label: 'Tax Rules', href: '/tax/rules', icon: <></> },
      ],
    },
    {
      label: 'HR & Payroll',
      href: '/hr',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      ),
      children: [
        { label: 'Employees', href: '/hr/employees', icon: <></> },
        { label: 'Attendance', href: '/hr/attendance', icon: <></> },
        { label: 'Leave', href: '/hr/leave', icon: <></> },
        { label: 'Payroll', href: '/hr/payroll', icon: <></> },
        { label: 'Surat Peringatan', href: '/hr/disciplinary', icon: <></> },
      ],
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ),
      children: [
        { label: 'Scheduled Jobs', href: '/settings/scheduled-jobs', icon: <></> },
        { label: 'Naixer KDS', href: '/settings/integrations/naixer', icon: <></> },
        { label: 'Custom Fields', href: '/settings/custom-fields', icon: <></> },
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
    <aside className="flex w-56 flex-col border-r border-brand-cream-3 bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-brand-cream-3 px-4">
        <img src="/logo-primary.png" alt="Aroadri Tea" width={28} height={28} className="h-7 w-7" />
        <span className="font-display text-base font-semibold text-brand-ink">ERP</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isCollapsed = collapsedSections.has(item.href);

            return (
              <li key={item.href}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleSection(item.href)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-red/10 text-brand-red'
                          : 'text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-ink'
                      }`}
                    >
                      {item.icon}
                      <span className="flex-1 text-left">{item.label}</span>
                      <svg
                        className={`h-3.5 w-3.5 text-brand-ink-3 transition-transform duration-150 ${
                          !isCollapsed ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>

                    {!isCollapsed && (
                      <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-brand-cream-3 pl-3">
                        {item.children!.map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
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
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-red/10 text-brand-red'
                        : 'text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-ink'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-brand-cream-3 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-brand-ink-3">Aroadri Tea ERP</p>
        <p className="text-[10px] text-brand-ink-3/60">v0.1.0 — Phase 1</p>
      </div>
    </aside>
  );
}
