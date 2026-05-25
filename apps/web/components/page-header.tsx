'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode; // Dipelihara untuk kompatibilitas props, tapi kita akan paksa pakai auto-breadcrumb
  breadcrumbs?: { label: React.ReactNode; href?: string }[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions, eyebrow }: PageHeaderProps) {
  const pathname = usePathname();

  // Jika tidak ada breadcrumbs eksplisit, kita generate otomatis dari URL agar 100% seragam
  const generateBreadcrumbs = () => {
    if (breadcrumbs && breadcrumbs.length > 0) return breadcrumbs;
    if (!pathname || pathname === '/') return [];

    const segments = pathname.split('/').filter(Boolean);
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

    const autoCrumbs: { label: string; href: string }[] = [];

    // Tambahkan root Dashboard di awal jika segmen pertama bukan 'dashboard'
    if (segments[0] !== 'dashboard') {
      autoCrumbs.push({ label: 'Dashboard', href: '/dashboard' });
    }

    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');
      // Khusus untuk HR, Po, dll agar tampilannya lebih bagus
      let label = capitalize(segment);
      if (segment.toLowerCase() === 'hr') label = 'HR';
      if (segment.toLowerCase() === 'po') label = 'PO';
      if (segment.toLowerCase() === 'coa') label = 'COA';
      if (segment.toLowerCase() === 'pos') label = 'POS';
      if (segment.toLowerCase() === 'cms') label = 'CMS';

      autoCrumbs.push({ label, href });
    });

    return autoCrumbs;
  };

  const displayBreadcrumbs = generateBreadcrumbs();

  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {displayBreadcrumbs.length > 0 && (
          <div className="mb-2 flex items-center gap-2 text-sm text-brand-ink-3">
            {displayBreadcrumbs.map((crumb, index) => {
              const isLast = index === displayBreadcrumbs.length - 1;
              return (
                <div key={index} className="flex items-center gap-2">
                  {!isLast && crumb.href ? (
                    <Link href={crumb.href} className="hover:text-brand-ink transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'font-medium text-brand-ink' : ''}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <span className="text-brand-cream-3">/</span>}
                </div>
              );
            })}
          </div>
        )}
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-brand-ink">{title}</h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
