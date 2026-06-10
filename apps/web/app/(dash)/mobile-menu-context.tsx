'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface MobileMenuCtx {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const Ctx = createContext<MobileMenuCtx>({ isOpen: false, toggle: () => {}, close: () => {} });

export function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return <Ctx.Provider value={{ isOpen, toggle, close }}>{children}</Ctx.Provider>;
}

export function useMobileMenu() {
  return useContext(Ctx);
}
