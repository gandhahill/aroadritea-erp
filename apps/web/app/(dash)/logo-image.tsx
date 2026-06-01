'use client';

/**
 * Client component wrapper for the mobile header logo.
 * Needed because onError is an event handler that cannot
 * be passed from a Server Component.
 */
export function LogoImage() {
  return (
    <img
      src="/logo-primary.png"
      alt="Aroadri"
      className="h-7 w-7 object-contain lg:hidden"
      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
