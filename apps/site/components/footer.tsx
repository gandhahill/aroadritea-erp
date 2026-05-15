/**
 * Public Site Footer - SD §31.1
 */
interface Props {
  brand: string;
  tagline: string;
  copyright: string;
  company: string;
  locationLine: string;
  socialLabel: string;
  instagramLabel: string;
  tiktokLabel: string;
}

export function PublicFooter({
  brand,
  tagline,
  copyright,
  company,
  locationLine,
  socialLabel,
  instagramLabel,
  tiktokLabel,
}: Props) {
  return (
    <footer className="border-t border-brand-red/10 bg-brand-ink text-brand-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white p-2 shadow-soft">
            <img src="/brand/logo-primary.png" alt="" className="h-full w-full object-contain" />
          </span>
          <div>
            <p className="brand-wordmark text-xl text-brand-cream">{brand}</p>
            <p className="brand-tagline mt-1 text-sm text-brand-cream/70">{tagline}</p>
          </div>
        </div>
        <div className="text-sm leading-6 text-brand-cream/68 md:text-right">
          <p>{company}</p>
          <p>{locationLine}</p>
          <p className="mt-3 font-semibold text-brand-cream/78">{socialLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2 md:justify-end">
            <a
              href="https://www.instagram.com/aroadri.tea/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-brand-cream/12 bg-brand-cream/8 px-3 py-2 text-brand-cream/76 transition-brand hover:-translate-y-0.5 hover:bg-brand-cream/14 hover:text-brand-cream focus-visible:outline-none focus-visible:shadow-focus"
            >
              <InstagramIcon />
              <span>{instagramLabel}</span>
            </a>
            <a
              href="https://www.tiktok.com/@aroadri.tea"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-brand-cream/12 bg-brand-cream/8 px-3 py-2 text-brand-cream/76 transition-brand hover:-translate-y-0.5 hover:bg-brand-cream/14 hover:text-brand-cream focus-visible:outline-none focus-visible:shadow-focus"
            >
              <TiktokIcon />
              <span>{tiktokLabel}</span>
            </a>
          </div>
          <p className="mt-3 text-xs text-brand-cream/52">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TiktokIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M15.7 3c.3 2.1 1.5 3.6 3.6 3.9v3.1a7 7 0 0 1-3.5-1v5.8c0 3.5-2.4 6.2-6.1 6.2A5.7 5.7 0 0 1 4 15.4c0-3.7 3.2-6.4 6.8-5.8v3.3c-1.6-.5-3.3.6-3.3 2.4 0 1.5 1 2.5 2.4 2.5s2.5-.9 2.5-2.8V3h3.3Z" />
    </svg>
  );
}
