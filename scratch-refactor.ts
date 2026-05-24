import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

const project = new Project();
project.addSourceFilesAtPaths('packages/services/src/**/*.ts');

for (const sourceFile of project.getSourceFiles()) {
  let modified = false;

  // Find all AwaitExpressions
  const awaitExprs = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression);
  for (const awaitExpr of awaitExprs) {
    const expr = awaitExpr.getExpression();
    if (!expr || expr.getKind() !== SyntaxKind.CallExpression) continue;
    
    // Look for `db.insert(auditLog).values(...)`
    const callExpr = expr.asKind(SyntaxKind.CallExpression);
    const propAccess = callExpr?.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
    if (!propAccess || propAccess.getName() !== 'values') continue;

    const innerCall = propAccess.getExpression().asKind(SyntaxKind.CallExpression);
    if (!innerCall) continue;
    
    const innerPropAccess = innerCall.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
    if (!innerPropAccess || innerPropAccess.getName() !== 'insert') continue;
    
    if (innerPropAccess.getExpression().getText() !== 'db') continue;
    
    const args = innerCall.getArguments();
    if (args.length !== 1 || args[0].getText() !== 'auditLog') continue;

    // Found db.insert(auditLog).values(...)
    const valuesArgs = callExpr.getArguments();
    if (valuesArgs.length !== 1) continue;
    
    const objectLiteral = valuesArgs[0].asKind(SyntaxKind.ObjectLiteralExpression);
    if (!objectLiteral) continue;

    const props = objectLiteral.getProperties();
    
    let action = '';
    let entityType = '';
    let entityId = '';
    let before = '';
    let after = '';
    let metadata = '';
    
    for (const prop of props) {
      if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
      const pa = prop.asKind(SyntaxKind.PropertyAssignment);
      const name = pa?.getName();
      const val = pa?.getInitializer()?.getText();
      
      if (name === 'action') action = val || '';
      if (name === 'entityType') entityType = val || '';
      if (name === 'entityId') entityId = val || '';
      if (name === 'before') before = val || '';
      if (name === 'after') after = val || '';
      if (name === 'metadata') metadata = val || '';
    }

    if (!action || !entityType || !entityId) continue;

    let newCall = `auditRecord({\n  action: ${action},\n  entityType: ${entityType},\n  entityId: ${entityId},\n`;
    if (before) newCall += `  before: ${before},\n`;
    if (after) newCall += `  after: ${after},\n`;
    if (metadata) newCall += `  metadata: ${metadata},\n`;
    newCall += `  ctx,\n})`;

    awaitExpr.replaceWithText(`await ${newCall}`);
    modified = true;
  }

  if (modified) {
    // Make sure auditRecord is imported
    const importDecs = sourceFile.getImportDeclarations();
    const hasAuditRecord = importDecs.some(i => i.getNamedImports().some(n => n.getName() === 'auditRecord'));
    if (!hasAuditRecord) {
      sourceFile.addImportDeclaration({
        namedImports: ['auditRecord'],
        moduleSpecifier: '../audit', // Might need fixing depending on directory depth
      });
    }

    // Remove auditLog import if no longer used
    const auditLogImport = importDecs.find(i => i.getNamedImports().some(n => n.getName() === 'auditLog'));
    if (auditLogImport && sourceFile.getText().split('auditLog').length === 2) { // 1 for import, 0 in code
      const names = auditLogImport.getNamedImports();
      if (names.length === 1) {
        auditLogImport.remove();
      } else {
        const namedImport = names.find(n => n.getName() === 'auditLog');
        namedImport?.remove();
      }
    }

    sourceFile.saveSync();
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}
