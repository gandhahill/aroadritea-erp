/**
 * GET /api/inventory/csv-template — Download CSV import template.
 */

import { NextResponse } from 'next/server';

const TEMPLATE_HEADER = 'KODE,KATEGORI,NAMA_BARANG,SATUAN,STOK_AWAL,HARGA_JUAL,HARGA_MODAL,JENIS';

const EXAMPLE_ROWS = [
  'W-BOT,Teh,Bamboo-scented Oolong Tea,Bungkus,19,0,0,raw_material',
  'GP500,Cup,Gelas Plastik 500ml,Pcs,604,0,0,consumable',
  'EGGTART,Bakery,Kulit Eggtart Shell,Pcs,1200,0,0,finished_good',
  'CHPSO,Topping,Cheese Pearl,Kaleng,8,5000,3000,finished_good',
];

export async function GET() {
  const csv = [TEMPLATE_HEADER, ...EXAMPLE_ROWS].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="inventory-import-template.csv"',
    },
  });
}
