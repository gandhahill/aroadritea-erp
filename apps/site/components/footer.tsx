/**
 * Public Site Footer - SD §31.1
 */
interface Props {
  brand: string;
  tagline: string;
  copyright: string;
}

export function PublicFooter({ brand, tagline, copyright }: Props) {
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
          <p>PT. Gandha Hill Catering Management Indonesia</p>
          <p>Yogyakarta · Jakarta</p>
          <p className="mt-3 text-xs text-brand-cream/52">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
