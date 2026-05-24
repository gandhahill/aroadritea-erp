const fs = require('fs');
const path = require('path');

function addImports(filePath, toInsert) {
  const fullPath = path.join(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes('import { FilterBar')) {
    content = content.replace('import { PageHeader', toInsert + '\nimport { PageHeader');
    fs.writeFileSync(fullPath, content);
  }
}

// 1. Whistleblower
addImports('apps/web/app/(dash)/hr/whistleblower/page.tsx', 'import { FilterBar, FilterField } from "@/components/filter-bar";');

// 2. GRN Report
let grnPath = path.join(__dirname, 'apps/web/app/(dash)/purchasing/grn-report/page.tsx');
let grnContent = fs.readFileSync(grnPath, 'utf8');
if (!grnContent.includes('FilterBar')) {
  grnContent = grnContent.replace('import { PageHeader', 'import { FilterBar, FilterField } from "@/components/filter-bar";\nimport { PageHeader');
}
if (!grnContent.includes('Input } from')) {
  grnContent = grnContent.replace('Select } from', 'Select, Input } from');
}
fs.writeFileSync(grnPath, grnContent);

// 3. PO Filter Table
let poPath = path.join(__dirname, 'apps/web/app/(dash)/purchasing/po-filter-table.tsx');
let poContent = fs.readFileSync(poPath, 'utf8');
if (!poContent.includes('FilterBar')) {
  poContent = poContent.replace('import { TableCell', 'import { FilterBar, FilterField } from "@/components/filter-bar";\nimport { TableCell');
}
if (!poContent.includes('Input } from')) {
  poContent = poContent.replace('Select } from', 'Select, Input } from');
}
// Fix any type
poContent = poContent.replace(/onChange={\(e\) => setQ\(e\.target\.value\)}/g, 'onChange={(e: any) => setQ(e.target.value)}');
poContent = poContent.replace(/onChange={\(e\) => setFrom\(e\.target\.value\)}/g, 'onChange={(e: any) => setFrom(e.target.value)}');
poContent = poContent.replace(/onChange={\(e\) => setTo\(e\.target\.value\)}/g, 'onChange={(e: any) => setTo(e.target.value)}');
fs.writeFileSync(poPath, poContent);

console.log("Imports fixed.");
