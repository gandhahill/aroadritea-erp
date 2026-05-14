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
          <img
            src="/brand/logo-monochrome.png"
            alt=""
            className="h-14 w-14 rounded-full bg-brand-cream object-cover"
          />
          <div>
            <p className="font-display text-xl font-bold text-brand-cream">{brand}</p>
            <p className="mt-1 text-sm text-brand-cream/70">{tagline}</p>
          </div>
        </div>
        <div className="text-sm leading-6 text-brand-cream/68 md:text-right">
          <p>{company}</p>
          <p>{locationLine}</p>
          <p className="mt-3 font-semibold text-brand-cream/78">{socialLabel}</p>
          <div className="mt-1 flex flex-wrap gap-3 md:justify-end">
            <a
              href="https://www.instagram.com/aroadri.tea/"
              target="_blank"
              rel="noreferrer"
              className="text-brand-cream/68 underline-offset-4 transition-brand hover:text-brand-cream hover:underline"
            >
              {instagramLabel}
            </a>
            <a
              href="https://www.tiktok.com/@aroadri.tea"
              target="_blank"
              rel="noreferrer"
              className="text-brand-cream/68 underline-offset-4 transition-brand hover:text-brand-cream hover:underline"
            >
              {tiktokLabel}
            </a>
          </div>
          <p className="mt-3 text-xs text-brand-cream/52">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
