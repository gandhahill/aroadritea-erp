const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(__dirname, 'apps/web/app/(dash)/sidebar.tsx');
let content = fs.readFileSync(sidebarPath, 'utf8');

// 1. Add imports
content = content.replace("import { useState } from 'react';", "import { useState, useEffect, useRef } from 'react';");

// 2. Add ref and useEffect
const hooksHook = `  const [isCollapsed, setIsCollapsed] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (navRef.current) {
      setTimeout(() => {
        const activeEl = navRef.current?.querySelector('[data-active="true"]');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }, [pathname, isCollapsed]);`;
content = content.replace("  const [isCollapsed, setIsCollapsed] = useState(false);", hooksHook);

// 3. Add ref to nav
content = content.replace('<nav className="flex-1 overflow-y-auto py-3 px-2 overflow-x-hidden">', '<nav ref={navRef} className="flex-1 overflow-y-auto py-3 px-2 overflow-x-hidden">');

// 4. Add data-active to child Link
content = content.replace(
  '<Link\n                                href={child.href}\n                                className={`block',
  '<Link\n                                href={child.href}\n                                data-active={childActive ? "true" : undefined}\n                                className={`block'
);

// 5. Add data-active to parent button
content = content.replace(
  '<button\n                      type="button"\n                      onClick={() => toggleSection(item.href)}\n                      className={`flex',
  '<button\n                      type="button"\n                      data-active={isActive && !item.children?.some(c => pathname === c.href) ? "true" : undefined}\n                      onClick={() => toggleSection(item.href)}\n                      className={`flex'
);

// 6. Add data-active to parent Link (without children)
content = content.replace(
  '<Link\n                    href={item.href}\n                    title={isCollapsed ? item.label : undefined}\n                    className={`flex',
  '<Link\n                    href={item.href}\n                    data-active={isActive ? "true" : undefined}\n                    title={isCollapsed ? item.label : undefined}\n                    className={`flex'
);

fs.writeFileSync(sidebarPath, content);
console.log("Patched sidebar.tsx");
