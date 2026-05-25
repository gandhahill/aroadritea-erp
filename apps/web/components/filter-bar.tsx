import type React from 'react';

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div
      className={`flex flex-wrap items-end gap-4 rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export interface FilterFieldProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterField({ label, children, className = '' }: FilterFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-medium text-brand-ink-3">{label}</label>}
      {children}
    </div>
  );
}
