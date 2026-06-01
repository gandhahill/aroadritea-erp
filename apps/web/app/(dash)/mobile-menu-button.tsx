'use client';

import { useMobileMenu } from './mobile-menu-context';

export function MobileMenuButton() {
  const { toggle } = useMobileMenu();

  return (
    <button
      type="button"
      onClick={toggle}
      className="lg:hidden rounded-md p-1.5 text-brand-ink-2 hover:bg-brand-cream-2 hover:text-brand-ink transition-colors"
      aria-label="Menu"
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>
  );
}
