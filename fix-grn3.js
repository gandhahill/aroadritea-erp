const fs = require('fs');
const file = 'packages/services/src/purchasing/grn-service.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add tryCatch import
content = content.replace(
  /import \{ type Result, err, ok \} from '@erp\/shared\/result';/,
  "import { type Result, err, ok, tryCatch } from '@erp/shared/result';"
);

// 2. Wrap block in tryCatch + db.transaction
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
block = block.replace(/  \}\);\n$/g, '  };\n');
if (block.endsWith('});')) {
  block = block.substring(0, block.length - 3) + '};';
}
if (block.endsWith('});\n')) {
  block = block.substring(0, block.length - 4) + '};\n';
}

// Fix jeResult rollback (we don't need to revert goodsReceiptNotes manually if we just throw the error inside a transaction!)
// Wait, the rollback in original code was:
/*
    if (!jeResult.ok) {
      await db
        .update(goodsReceiptNotes)
        .set({ status: 'draft', version: grn.version })
        .where(eq(goodsReceiptNotes.id, grn.id));
      return jeResult;
    }
*/
// Now we can just throw the error because it's a transaction!
block = block.replace(
  /    if \(!jeResult\.ok\) \{\n[\s\S]*?return jeResult;\n    \}/m,
  '    if (!jeResult.ok) throw jeResult.error;'
);

block = block.replace(/ctx, \{ skipPermissionCheck: true \}/g, 'ctx, { skipPermissionCheck: true, tx }');

const wrapper = `  return tryCatch(async () => {\n    return await db.transaction(async (tx) => {\n${block.split('\\n').map(l => '      ' + l).join('\\n')}\n    });\n  }, (e: any) => {\n    if (e && typeof e === 'object' && 'messageKey' in e) return e as AppError;\n    return AppError.internal('purchasing.errors.grn_confirm_failed', e);\n  });`;

content = content.substring(0, startIdx) + wrapper + content.substring(endIdx);
fs.writeFileSync(file, content);
