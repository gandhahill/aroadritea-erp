'use client';

export type WorkbookCell = string | number | boolean | Date | null | undefined;

export type WorkbookSheet = {
  name: string;
  rows: WorkbookCell[][];
};

export async function exportWorkbook(filename: string, sheets: WorkbookSheet[]) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aroadri Tea ERP';
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
    worksheet.addRows(sheet.rows.map((row) => row.map((cell) => cell ?? '')));
    worksheet.columns = buildColumnWidths(sheet.rows);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildColumnWidths(rows: WorkbookCell[][]) {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return Array.from({ length: maxColumns }, (_, columnIndex) => {
    const maxLength = rows.reduce((max, row) => {
      const value = row[columnIndex];
      return Math.max(max, String(value ?? '').length);
    }, 10);

    return { width: Math.min(Math.max(maxLength + 2, 12), 40) };
  });
}
