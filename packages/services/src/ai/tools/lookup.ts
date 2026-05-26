const LOOKUP_STOPWORDS = new Set([
  'aroadri',
  'outlet',
  'store',
  'toko',
  'gerai',
  'cabang',
  'di',
  'ke',
  'the',
  'and',
  'dan',
  'pt',
]);

export function normaliseLookup(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function lookupTokens(raw: string, maxTokens = 6): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of normaliseLookup(raw).split(' ')) {
    if (token.length < 2 || /^\d+$/.test(token) || LOOKUP_STOPWORDS.has(token) || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= maxTokens) break;
  }
  return tokens;
}

export function flattenLocalizedName(name: unknown): string {
  if (!name || typeof name !== 'object') return '';
  const record = name as Record<string, unknown>;
  return ['id', 'en', 'zh']
    .map((locale) => record[locale])
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

export function containsAllLookupTokens(text: string, tokens: string[]): boolean {
  const searchable = normaliseLookup(text);
  return tokens.every((token) => searchable.includes(token));
}
