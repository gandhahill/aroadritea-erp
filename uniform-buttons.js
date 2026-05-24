const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  const fullPath = path.join(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  for (const { search, replace } of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
  }
}

// 1. TSX Files
replaceInFile('apps/web/app/(dash)/reporting/hourly-sales/hourly-sales-client.tsx', [
  { search: "{isPending ? '...' : t('filter')}", replace: "{isPending ? '...' : t('filterBtn')}" }
]);
replaceInFile('apps/web/app/(dash)/reporting/daily-summary/daily-summary-client.tsx', [
  { search: "t('show')", replace: "t('filterBtn')" }
]);
replaceInFile('apps/web/app/(dash)/pos/orders/page.tsx', [
  { search: "{t('show')}", replace: "{t('filterBtn')}" }
]);
replaceInFile('apps/web/app/(dash)/inventory/variance/variance-client.tsx', [
  { search: "t('show')", replace: "t('filterBtn')" }
]);

// 2. JSON Files
function updateJson(filePath, updater) {
  const fullPath = path.join(__dirname, filePath);
  let obj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  updater(obj);
  fs.writeFileSync(fullPath, JSON.stringify(obj, null, 2) + '\n');
}

const locales = ['en.json', 'id.json', 'zh.json'];
locales.forEach(loc => {
  updateJson(`apps/web/messages/${loc}`, (obj) => {
    const text = loc === 'id.json' ? 'Tampilkan' : loc === 'zh.json' ? '显示' : 'Filter';

    if (!obj.reporting) obj.reporting = {};
    if (!obj.reporting.hourlySales) obj.reporting.hourlySales = {};
    obj.reporting.hourlySales.filterBtn = text;

    if (!obj.reporting.dailySummary) obj.reporting.dailySummary = {};
    obj.reporting.dailySummary.filterBtn = text;

    if (!obj.pos) obj.pos = {};
    if (!obj.pos.orders) obj.pos.orders = {};
    obj.pos.orders.filterBtn = text;

    if (!obj.inventory) obj.inventory = {};
    if (!obj.inventory.variance) obj.inventory.variance = {};
    obj.inventory.variance.filterBtn = text;

    // Also update existing filterBtn in whistleblower, disciplinary, grn-report to "Tampilkan" for id.json
    if (loc === 'id.json') {
      if (obj.hr && obj.hr.whistleblower) obj.hr.whistleblower.filterBtn = 'Tampilkan';
      if (obj.hr && obj.hr.disciplinary) obj.hr.disciplinary.filterBtn = 'Tampilkan';
      if (obj.purchasing && obj.purchasing.grnReport) obj.purchasing.grnReport.filterBtn = 'Tampilkan';
      if (obj.nav) obj.nav.filterBtn = 'Tampilkan';
    }
  });
});

console.log('Uniform buttons applied.');
