const fs = require('fs');
const path = require('path');

function appendFormClose(filePath) {
  const fullPath = path.join(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  if (content.includes('</FilterBar>') && !content.includes('</FilterBar>\n      </form>')) {
    content = content.replace('</FilterBar>', '</FilterBar>\n      </form>');
    fs.writeFileSync(fullPath, content);
    console.log(`Fixed ${filePath}`);
  }
}

appendFormClose('apps/web/app/(dash)/hr/whistleblower/page.tsx');
appendFormClose('apps/web/app/(dash)/purchasing/grn-report/page.tsx');

console.log("Done.");
