import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';

const project = new Project();
project.addSourceFilesAtPaths('apps/web/app/**/*.tsx');

const sourceFiles = project.getSourceFiles();

const INPUT_REGEX = /w-full[^'"]+/; 

let modifiedCount = 0;

for (const sourceFile of sourceFiles) {
  let needsUiImport = false;
  let imports = new Set();
  let modified = false;

  const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement);
  const selfClosingElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  
  const processElement = (node, tagNameNode) => {
    const openingNode = node.getKind() === SyntaxKind.JsxElement ? node.getOpeningElement() : node;
    const tagName = tagNameNode.getText();
    
    if (tagName === 'button') {
      const classNameAttr = openingNode.getAttribute('className');
      if (classNameAttr) {
        const text = classNameAttr.getText();
        if (text.includes('bg-brand-red') && text.includes('px-5 py-2')) {
          tagNameNode.replaceWithText('Button');
          node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('Button');
          openingNode.addAttribute({ name: 'variant', initializer: '"primary"' });
          openingNode.addAttribute({ name: 'size', initializer: '"lg"' });
          needsUiImport = true;
          imports.add('Button');
          modified = true;
        } else if (text.includes('bg-brand-red') && text.includes('px-4 py-2')) {
          tagNameNode.replaceWithText('Button');
          node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('Button');
          openingNode.addAttribute({ name: 'variant', initializer: '"primary"' });
          openingNode.addAttribute({ name: 'size', initializer: '"md"' });
          needsUiImport = true;
          imports.add('Button');
          modified = true;
        } else if (text.includes('bg-brand-red') && text.includes('px-3 py-1.5')) {
          tagNameNode.replaceWithText('Button');
          node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('Button');
          openingNode.addAttribute({ name: 'variant', initializer: '"primary"' });
          openingNode.addAttribute({ name: 'size', initializer: '"sm"' });
          needsUiImport = true;
          imports.add('Button');
          modified = true;
        } else if (text.includes('border-brand-cream-3 bg-card px-4 py-2')) {
          tagNameNode.replaceWithText('Button');
          node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('Button');
          openingNode.addAttribute({ name: 'variant', initializer: '"secondary"' });
          openingNode.addAttribute({ name: 'size', initializer: '"md"' });
          needsUiImport = true;
          imports.add('Button');
          modified = true;
        } else if (text.includes('text-rose-600') && text.includes('hover:bg-rose-50')) {
          tagNameNode.replaceWithText('Button');
          node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('Button');
          openingNode.addAttribute({ name: 'variant', initializer: '"danger"' });
          openingNode.addAttribute({ name: 'size', initializer: '"sm"' });
          needsUiImport = true;
          imports.add('Button');
          modified = true;
        }
      }
    } else if (tagName === 'input' || tagName === 'select') {
      const classNameAttr = openingNode.getAttribute('className');
      if (classNameAttr && (classNameAttr.getText().includes('INPUT') || INPUT_REGEX.test(classNameAttr.getText()))) {
        const replacement = tagName === 'input' ? 'Input' : 'Select';
        tagNameNode.replaceWithText(replacement);
        if (node.getKind() === SyntaxKind.JsxElement) {
            node.getClosingElement()?.getTagNameNode()?.replaceWithText(replacement);
        }
        needsUiImport = true;
        imports.add(replacement);
        modified = true;
      }
    } else if (tagName === 'table') {
      const classNameAttr = openingNode.getAttribute('className');
      if (classNameAttr && classNameAttr.getText().includes('divide-brand-cream-3')) {
        tagNameNode.replaceWithText('Table');
        node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('Table');
        needsUiImport = true;
        imports.add('Table');
        modified = true;
      }
    } else if (tagName === 'thead') {
      const classNameAttr = openingNode.getAttribute('className');
      if (classNameAttr && classNameAttr.getText().includes('bg-brand-cream-1')) {
        tagNameNode.replaceWithText('TableHeader');
        node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('TableHeader');
        needsUiImport = true;
        imports.add('TableHeader');
        modified = true;
      }
    } else if (tagName === 'tbody') {
      const classNameAttr = openingNode.getAttribute('className');
      if (classNameAttr && classNameAttr.getText().includes('divide-brand-cream-3')) {
        tagNameNode.replaceWithText('TableBody');
        node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('TableBody');
        needsUiImport = true;
        imports.add('TableBody');
        modified = true;
      }
    } else if (tagName === 'th') {
      const classNameAttr = openingNode.getAttribute('className');
      if (classNameAttr && classNameAttr.getText().includes('px-4 py-3')) {
        tagNameNode.replaceWithText('TableHead');
        node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('TableHead');
        needsUiImport = true;
        imports.add('TableHead');
        modified = true;
      }
    } else if (tagName === 'td') {
      const classNameAttr = openingNode.getAttribute('className');
      if (classNameAttr && classNameAttr.getText().includes('px-4 py-3')) {
        tagNameNode.replaceWithText('TableCell');
        node.getClosingElement?.()?.getTagNameNode()?.replaceWithText('TableCell');
        needsUiImport = true;
        imports.add('TableCell');
        modified = true;
      }
    }
  };

  const allNodes = [...jsxElements, ...selfClosingElements].sort((a, b) => b.getStart() - a.getStart());

  for (const node of allNodes) {
    const tagNameNode = node.getKind() === SyntaxKind.JsxElement 
      ? node.getOpeningElement().getTagNameNode() 
      : node.getTagNameNode();
    processElement(node, tagNameNode);
  }

  const varDecls = sourceFile.getVariableDeclarations();
  for (const varDecl of varDecls.reverse()) {
    if (varDecl.getName() === 'INPUT') {
      const stmt = varDecl.getVariableStatement();
      if (stmt) {
        stmt.remove();
        modified = true;
      }
    }
  }

  if (modified && needsUiImport) {
    const importDecls = sourceFile.getImportDeclarations();
    const lastImport = importDecls[importDecls.length - 1];
    if (lastImport) {
      sourceFile.insertImportDeclaration(lastImport.getChildIndex() + 1, {
        namedImports: Array.from(imports),
        moduleSpecifier: '@erp/ui'
      });
    } else {
      sourceFile.insertImportDeclaration(0, {
        namedImports: Array.from(imports),
        moduleSpecifier: '@erp/ui'
      });
    }
  }

  if (modified) {
    let text = sourceFile.getFullText();
    text = text.replace(/ className=""/g, '');
    
    const longInputClass = /className=['"]w-full rounded-lg border border-brand-cream-3 bg-(?:card|brand-cream) px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3\/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5['"]/g;
    text = text.replace(longInputClass, '');

    const longSelectClass = /className=['"]w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5 disabled:opacity-50 disabled:cursor-not-allowed['"]/g;
    text = text.replace(longSelectClass, '');

    text = text.replace(/bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark( disabled:opacity-50)?/g, '');
    text = text.replace(/bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark( disabled:opacity-50)?/g, '');
    text = text.replace(/border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1( disabled:opacity-50)?/g, '');
    text = text.replace(/px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-30/g, '');
    text = text.replace(/min-w-full divide-y divide-brand-cream-3 text-sm/g, '');
    text = text.replace(/bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3/g, '');
    text = text.replace(/divide-y divide-brand-cream-3 bg-card/g, '');
    
    text = text.replace(/ className=['"]\s*['"]/g, '');
    text = text.replace(/ className=\{\s*['"]\s*['"]\s*\}/g, '');
    text = text.replace(/ className=\{INPUT\}/g, '');

    fs.writeFileSync(sourceFile.getFilePath(), text, 'utf8');
    modifiedCount++;
  }
}

console.log(`Successfully modified ${modifiedCount} files.`);
