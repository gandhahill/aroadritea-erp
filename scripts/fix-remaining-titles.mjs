import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', 'apps', 'web', 'app');

const MAP = {
  '(dash)/accounting/assets/page.tsx': 'Fixed Assets',
  '(dash)/accounting/bank-recon/page.tsx': 'Bank Reconciliation',
  '(dash)/accounting/bank-recon/import/page.tsx': 'Import Bank Statement',
  '(dash)/accounting/bank-recon/[id]/page.tsx': 'Bank Reconciliation Detail',
  '(dash)/cms/docs/page.tsx': 'CMS Documentation',
  '(dash)/crm/members/[id]/page.tsx': 'Member Detail',
  '(dash)/helpdesk/[id]/page.tsx': 'Ticket Detail',
  '(dash)/hr/employees/[id]/page.tsx': 'Employee Detail',
  '(dash)/inventory/adjust/page.tsx': 'Quick Adjustment',
  '(dash)/inventory/opname/[id]/page.tsx': 'Stock Opname Detail',
  '(dash)/inventory/transfer/page.tsx': 'Stock Transfer',
  '(dash)/inventory/transfer/new/page.tsx': 'New Stock Transfer',
  '(dash)/inventory/transfer/[id]/page.tsx': 'Transfer Detail',
  '(dash)/logistics/outgoing-shipments/page.tsx': 'Outgoing Shipments',
  '(dash)/purchasing/returns/[id]/page.tsx': 'Purchase Return Detail',
  '(dash)/reporting/business-intelligence/page.tsx': 'Business Intelligence',
  '(dash)/reporting/omzet-harian/page.tsx': 'Daily Sales',
};

const SUFFIX = ' | Aroadri ERP';

for (const [relPath, titlePrefix] of Object.entries(MAP)) {
  const fullPath = path.join(webRoot, ...relPath.split('/'));
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    const fullTitle = titlePrefix + SUFFIX;

    const metadataRegex = /(export\s+const\s+metadata[\s\S]*?title:\s*)['"](.*?)['"]/;
    const metadataRegex2 = /(metadata\s*=\s*\{[^}]*?title:\s*)['"](.*?)['"]/;
    
    let match = content.match(metadataRegex) || content.match(metadataRegex2);
    
    if (!match) {
      // sometimes it's just `title: '...'` inside an object without `metadata = ` around it
      // like `export const metadata = { title: '...' }` but split across lines
      const fallbackRegex = /(title:\s*)['"](.*?)['"]/;
      const m = content.match(fallbackRegex);
      if (m && !m[0].includes('ReactNode') && !m[0].includes('string')) {
          match = m;
      }
    }

    if (match) {
      content = content.replace(match[0], `${match[1]}'${fullTitle}'`);
      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`UPDATED: ${relPath} -> ${fullTitle}`);
    } else {
       console.log(`COULD NOT MATCH: ${relPath}`);
    }
  } else {
     console.log(`NOT FOUND: ${relPath}`);
  }
}
