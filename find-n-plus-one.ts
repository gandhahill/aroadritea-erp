import { Project, SyntaxKind } from 'ts-morph';

const project = new Project();
project.addSourceFilesAtPaths('packages/services/src/**/*.ts');

for (const sourceFile of project.getSourceFiles()) {
  const loops = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ForOfStatement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ForInStatement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.WhileStatement),
  ];

  for (const loop of loops) {
    const awaitExprs = loop.getDescendantsOfKind(SyntaxKind.AwaitExpression);
    for (const awaitExpr of awaitExprs) {
      const text = awaitExpr.getText();
      if (text.includes('db.select') || text.includes('db.query')) {
        console.log(`Potential N+1 Query in ${sourceFile.getFilePath()}:${awaitExpr.getStartLineNumber()}`);
        console.log(text.substring(0, 100) + '...\n');
      }
    }
  }
}
