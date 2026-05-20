const TEMPLATE = [
  [
    'posting_date',
    'location_code',
    'description',
    'reference_id',
    'account_code',
    'line_description',
    'debit',
    'credit',
  ],
  [
    '2026-05-20',
    'MALIOBORO',
    'Contoh jurnal import',
    'IMPORT-001',
    '1-1300',
    'Kas masuk',
    '100000',
    '0',
  ],
  [
    '2026-05-20',
    'MALIOBORO',
    'Contoh jurnal import',
    'IMPORT-001',
    '4-1100',
    'Pendapatan',
    '0',
    '100000',
  ],
];

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function GET() {
  const body = TEMPLATE.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="journal-import-template.csv"',
    },
  });
}
