import Link from 'next/link';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  breadcrumbs?: { label: React.ReactNode; href?: string }[];
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-2 flex items-center gap-2 text-sm text-brand-ink-3">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={index} className="flex items-center gap-2">
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-brand-ink transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'font-medium text-brand-ink' : ''}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <span>/</span>}
                </div>
              );
            })}
          </div>
        )}
        {!breadcrumbs && eyebrow && (
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-brand-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0">{actions}</div>
      )}
    </div>
  );
}
