/**
 * Public Site Footer - SD §31.1
 */
interface Props {
  copyright: string;
}

export function PublicFooter({ copyright }: Props) {
  return (
    <footer className="border-t border-brand-cream-3 bg-brand-cream-3 py-8 text-center text-sm text-brand-ink-3">
      <p>{copyright}</p>
    </footer>
  );
}
