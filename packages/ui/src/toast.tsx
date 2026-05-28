'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-brand-ink group-[.toaster]:border-brand-cream-3 group-[.toaster]:shadow-lg font-sans',
          description: 'group-[.toast]:text-brand-ink-3',
          actionButton:
            'group-[.toast]:bg-brand-red group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-brand-cream-1 group-[.toast]:text-brand-ink-2',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
