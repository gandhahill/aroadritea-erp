import React from 'react';

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div className={`flex flex-col sm:flex-row flex-wrap items-center gap-3 ${className}`}>
      {children}
    </div>
  );
}
