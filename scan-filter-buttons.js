const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      walk(path.join(dir, file), fileList);
    } else if (file.endsWith('.tsx')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const files = walk(path.join(__dirname, 'apps/web/app/(dash)'));

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('<FilterBar')) {
    const matches = content.match(/<Button[^>]*>([\s\S]*?)<\/Button>/g);
    if (matches) {
      for (const match of matches) {
        if (match.toLowerCase().includes('filter') || match.toLowerCase().includes('tampilkan')) {
          console.log(`File: ${file}`);
          console.log(`Button: ${match}`);
          console.log('---');
        }
      }
    }
  }
}
