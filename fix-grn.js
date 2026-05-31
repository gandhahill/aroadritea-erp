const fs = require('fs');
const file = 'packages/services/src/purchasing/grn-service.ts';
let content = fs.readFileSync(file, 'utf8');

const startStr = '// CLAIM the GRN first.';
const startIdx = content.indexOf(startStr);
const endStr = 'return ok({';
let endIdx = content.indexOf(endStr, startIdx);
endIdx = content.indexOf('}', endIdx) + 1; // find end of ok object
endIdx = content.indexOf(';', endIdx) + 1; // find end of return statement

let block = content.substring(startIdx, endIdx);

block = block.replace(/await db\./g, 'await tx.');

block = block.replace(/return err\((AppError\.[^)]+)\);/g, 'throw $1;');
block = block.replace(/return err\(AppError\.conflict\('purchasing\.errors\.version_mismatch'\)\);/g, "throw AppError.conflict('purchasing.errors.version_mismatch');");
block = block.replace(/return err\(\s*AppError\.businessRule\('purchasing\.errors\.grni_account_not_found'\)\s*\);/g, "throw AppError.businessRule('purchasing.errors.grni_account_not_found');");
block = block.replace(/return err\(\s*AppError\.businessRule\('purchasing\.errors\.inventory_account_not_found'\)\s*\);/gm, "throw AppError.businessRule('purchasing.errors.inventory_account_not_found');");

// createJournal rollback
block = block.replace(
  /if \(!jeResult\.ok\) \{\s*await tx\s*\.update\(goodsReceiptNotes\)\s*\.set\(\{ status: 'draft', version: grn\.version \}\)\s*\.where\(eq\(goodsReceiptNotes\.id, grn\.id\)\);\s*return jeResult;\s*\}/m,
  'if (!jeResult.ok) throw jeResult.error;'
);

block = block.replace(/ctx, \{ skipPermissionCheck: true \}/g, 'ctx, { skipPermissionCheck: true, tx }');

const wrapper = `  return tryCatch(async () => {\n    return await db.transaction(async (tx) => {\n${block.split('\\n').map(l => '      ' + l).join('\\n')}\n    });\n  }, (e: any) => {\n    if (e && typeof e === 'object' && 'messageKey' in e) return err(e as AppError);\n    return err(AppError.internal('purchasing.errors.grn_confirm_failed', e));\n  });`;

content = content.substring(0, startIdx) + wrapper + content.substring(endIdx);
fs.writeFileSync(file, content);
