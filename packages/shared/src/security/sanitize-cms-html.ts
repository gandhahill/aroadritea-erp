/**
 * Conservative sanitizer for CMS-authored public HTML.
 *
 * This is intentionally allowlist-based: unknown tags are unwrapped, dangerous
 * block tags are removed with their content, and URL-bearing attributes must use
 * a safe protocol or a relative URL.
 */

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const DANGEROUS_BLOCK_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'form',
  'textarea',
  'button',
  'input',
  'select',
  'option',
  'link',
  'meta',
  'base',
];

const URI_ATTRIBUTES = new Set(['href', 'src']);
const GLOBAL_ATTRIBUTES = new Set(['class', 'title']);

const ATTRIBUTES_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
};

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeUrlForProtocolCheck(value: string): string {
  return [...value.trim()]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 0x1f && code !== 0x7f && !/\s/.test(char);
    })
    .join('')
    .toLowerCase();
}

function isSafeUrl(value: string, tagName: string): boolean {
  const normalized = normalizeUrlForProtocolCheck(value);
  if (!normalized) return false;
  if (normalized.startsWith('/') || normalized.startsWith('#')) return true;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return true;
  if (tagName === 'a' && (normalized.startsWith('mailto:') || normalized.startsWith('tel:'))) {
    return true;
  }
  return false;
}

function isAllowedAttribute(tagName: string, attributeName: string): boolean {
  const name = attributeName.toLowerCase();
  if (name.startsWith('on') || name === 'style' || name === 'srcdoc') return false;
  if (GLOBAL_ATTRIBUTES.has(name)) return true;
  return ATTRIBUTES_BY_TAG[tagName]?.has(name) ?? false;
}

function sanitizeAttributes(tagName: string, rawAttributes: string): string {
  const attributes: string[] = [];
  const attrPattern = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(rawAttributes)) !== null) {
    const rawName = match[1] ?? '';
    const name = rawName.toLowerCase();
    if (!isAllowedAttribute(tagName, name)) continue;

    const rawValue = match[2];
    const value = rawValue
      ? rawValue.replace(/^["']|["']$/g, '')
      : name === 'loading'
        ? 'lazy'
        : '';

    if (URI_ATTRIBUTES.has(name) && !isSafeUrl(value, tagName)) continue;
    if (
      (name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan') &&
      !/^\d{1,4}$/.test(value)
    ) {
      continue;
    }
    if (name === 'target' && !['_blank', '_self'].includes(value)) continue;
    if (name === 'loading' && !['lazy', 'eager'].includes(value)) continue;

    if (tagName === 'a' && name === 'target' && value === '_blank') {
      attributes.push('target="_blank"', 'rel="noopener noreferrer"');
      continue;
    }

    if (name === 'rel' && tagName === 'a') {
      attributes.push('rel="noopener noreferrer"');
      continue;
    }

    attributes.push(`${name}="${escapeAttribute(value)}"`);
  }

  if (tagName === 'img' && !attributes.some((attr) => attr.startsWith('loading='))) {
    attributes.push('loading="lazy"');
  }

  return attributes.length ? ` ${Array.from(new Set(attributes)).join(' ')}` : '';
}

export function sanitizeCmsHtml(input: string): string {
  let output = input.replace(/<!--[\s\S]*?-->/g, '');

  for (const tag of DANGEROUS_BLOCK_TAGS) {
    const paired = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi');
    const single = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    let previous: string;
    do {
      previous = output;
      output = output.replace(paired, '').replace(single, '');
    } while (output !== previous);
  }

  return output.replace(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g, (raw, tagNameRaw, rawAttributes) => {
    const tagName = String(tagNameRaw).toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) return '';

    const isClosing = /^<\//.test(raw);
    if (isClosing) return `</${tagName}>`;
    if (tagName === 'br' || tagName === 'hr') return `<${tagName}>`;

    const attrs = sanitizeAttributes(tagName, String(rawAttributes ?? ''));
    const selfClosing = /\/\s*>$/.test(raw) && tagName === 'img';
    return selfClosing ? `<${tagName}${attrs}>` : `<${tagName}${attrs}>`;
  });
}
