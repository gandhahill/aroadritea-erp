const fs = require('fs');
const file = 'packages/services/src/purchasing/grn-service.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add tryCatch import
content = content.replace(
  /import \{ type Result, err, ok \} from '@erp\/shared\/result';/,
  "import { type Result, err, ok, tryCatch } from '@erp/shared/result';"
);

// 2. Extract block
const startStr = '// CLAIM the GRN first.';
const startIdx = content.indexOf(startStr);
const endStr = 'return ok({';
let endIdx = content.indexOf(endStr, startIdx);
endIdx = content.indexOf('}', endIdx) + 1;
endIdx = content.indexOf(';', endIdx) + 1;

let block = content.substring(startIdx, endIdx);

block = block.replace(/await db\./g, 'await tx.');

block = block.replace(/return err\((AppError\.[^)]+)\);/g, 'throw $1;');
block = block.replace(/return err\(AppError\.conflict\('purchasing\.errors\.version_mismatch'\)\);/g, "throw AppError.conflict('purchasing.errors.version_mismatch');");
block = block.replace(/return err\(\s*AppError\.businessRule\('purchasing\.errors\.grni_account_not_found'\)\s*\);/g, "throw AppError.businessRule('purchasing.errors.grni_account_not_found');");
block = block.replace(/return err\(\s*AppError\.businessRule\('purchasing\.errors\.inventory_account_not_found'\)\s*\);/gm, "throw AppError.businessRule('purchasing.errors.inventory_account_not_found');");

block = block.replace(/return ok\(\{/g, 'return {');
if (block.endsWith('});')) {
  block = block.substring(0, block.length - 3) + '};';
} else if (block.endsWith('});\r\n')) {
  block = block.substring(0, block.length - 5) + '};\r\n';
} else if (block.endsWith('});\n')) {
  block = block.substring(0, block.length - 4) + '};\n';
} else if (block.endsWith('});\n\n')) {
  block = block.substring(0, block.length - 5) + '};\n\n';
} else if (block.endsWith('});\r\n\r\n')) {
  block = block.substring(0, block.length - 7) + '};\r\n\r\n';
}

// 3. Fix jeResult
const jeResultRollback = `          if (!jeResult.ok) {
            await tx
              .update(goodsReceiptNotes)
              .set({ status: 'draft', version: grn.version })
              .where(eq(goodsReceiptNotes.id, grn.id));
            return jeResult;
          }`;
const jeResultRollbackWindows = jeResultRollback.split('\n').join('\r\n');

if (block.includes(jeResultRollback)) {
  block = block.replace(jeResultRollback, '          if (!jeResult.ok) throw jeResult.error;');
} else if (block.includes(jeResultRollbackWindows)) {
  block = block.replace(jeResultRollbackWindows, '          if (!jeResult.ok) throw jeResult.error;');
} else {
  console.log("WARNING: Did not find jeResult rollback block exactly! Will try regex.");
  block = block.replace(/          if \(!jeResult\.ok\) \{\r?\n            await tx\r?\n              \.update\(goodsReceiptNotes\)\r?\n              \.set\(\{ status: 'draft', version: grn\.version \}\)\r?\n              \.where\(eq\(goodsReceiptNotes\.id, grn\.id\)\);\r?\n            return jeResult;\r?\n          \}/g, '          if (!jeResult.ok) throw jeResult.error;');
}

block = block.replace(/ctx, \{ skipPermissionCheck: true \}/g, 'ctx, { skipPermissionCheck: true, tx }');

const blockLines = block.split('\n').map(l => {
  if (l.trim() === '') return '';
  return '      ' + l;
}).join('\n');

const wrapper = `  return tryCatch(async () => {
    return await db.transaction(async (tx) => {
${blockLines}
    });
  }, (e: any) => {
    if (e && typeof e === 'object' && 'messageKey' in e) return e as AppError;
    return AppError.internal('purchasing.errors.grn_confirm_failed', e);
  });`;

content = content.substring(0, startIdx) + wrapper + content.substring(endIdx);
fs.writeFileSync(file, content);
