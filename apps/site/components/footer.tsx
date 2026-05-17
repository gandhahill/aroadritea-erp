/**
 * Public Site Footer - SD §31.1
 *
 * Social links are passed in by the layout so we can swap providers per
 * locale (e.g. for zh users we link to Xiaohongshu / Douyin instead of
 * Instagram / TikTok, which are blocked in mainland China).
 */
export type SocialKind = 'instagram' | 'tiktok' | 'xiaohongshu' | 'douyin' | 'wechat';

export interface SocialLink {
  kind: SocialKind;
  href: string;
  label: string;
}

interface Props {
  brand: string;
  tagline: string;
  copyright: string;
  company: string;
  locationLine: string;
  socialLabel: string;
  socials: SocialLink[];
}

export function PublicFooter({
  brand,
  tagline,
  copyright,
  company,
  locationLine,
  socialLabel,
  socials,
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
          {socials.length > 0 ? (
            <>
              <p className="mt-3 font-semibold text-brand-cream/78">{socialLabel}</p>
              <div className="mt-2 flex flex-wrap gap-2 md:justify-end">
                {socials.map((social) => (
                  <a
                    key={social.kind}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-brand-cream/12 bg-brand-cream/8 px-3 py-2 text-brand-cream/76 transition-brand hover:-translate-y-0.5 hover:bg-brand-cream/14 hover:text-brand-cream focus-visible:outline-none focus-visible:shadow-focus"
                  >
                    <SocialIcon kind={social.kind} />
                    <span>{social.label}</span>
                  </a>
                ))}
              </div>
            </>
          ) : null}
          <p className="mt-3 text-xs text-brand-cream/52">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ kind }: { kind: SocialKind }) {
  switch (kind) {
    case 'instagram':
      return <InstagramIcon />;
    case 'tiktok':
      return <TiktokIcon />;
    case 'xiaohongshu':
      return <XiaohongshuIcon />;
    case 'douyin':
      return <DouyinIcon />;
    case 'wechat':
      return <WechatIcon />;
  }
}

function XiaohongshuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M4 4h16v16H4z" fillOpacity="0" />
      <text x="3" y="17" fontSize="11" fontWeight="900" fontFamily="system-ui">小红</text>
    </svg>
  );
}

function DouyinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M13 3v11.2a3 3 0 1 1-3-3v-3a6 6 0 1 0 6 6V8.4c1 .7 2.2 1.2 3.5 1.2V6.5C17.4 6.2 15.6 4.8 15 3h-2Z" />
    </svg>
  );
}

function WechatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M8.6 4C5 4 2 6.4 2 9.3c0 1.6.9 3 2.3 4l-.5 2 2.3-1.2c.7.2 1.4.3 2.1.3l.7-.1A5.4 5.4 0 0 1 9 13c0-3 3-5.5 6.7-5.5h.6C15.5 5.4 12.3 4 8.6 4Zm-2 3a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm4.8 0a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Zm4.5 2.3c-3.2 0-5.8 2.1-5.8 4.7s2.6 4.7 5.8 4.7c.6 0 1.3-.1 1.9-.3l2 1-.5-1.7c1.3-.9 2.1-2.2 2.1-3.7 0-2.6-2.6-4.7-5.5-4.7Zm-1.6 1.9a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Zm3.2 0a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Z" />
    </svg>
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
