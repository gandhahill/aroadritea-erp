'use client';

import { forwardRef, useCallback } from 'react';
import { cn } from './utils';

export interface IntegerInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

const baseInputStyles =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5 disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Integer-only input — rejects decimal points, commas, and non-numeric input.
 * Use for stock quantities, counts, and other whole-number fields.
 */
export const IntegerInput = forwardRef<HTMLInputElement, IntegerInputProps>(
  ({ className, onChange, onKeyDown, onFocus, ...props }, ref) => {
    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Select the existing value on focus so the first keystroke replaces a
        // pre-filled default (e.g. "0") instead of appending to it.
        e.target.select();
        onFocus?.(e);
      },
      [onFocus],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Block decimal point, comma, and 'e' (scientific notation)
        if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          return;
        }
        onKeyDown?.(e);
      },
      [onKeyDown],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        // Strip any non-integer characters that might get pasted
        const raw = e.target.value;
        const cleaned = raw.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
        if (cleaned !== raw) {
          e.target.value = cleaned;
        }
        onChange?.(e);
      },
      [onChange],
    );

    return (
      <input
        ref={ref}
        type="number"
        step="1"
        className={cn(baseInputStyles, 'tabular-nums', className)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[^\d-]/.test(text.replace(/^-/, ''))) {
            e.preventDefault();
            // Insert only the integer part
            const cleaned = text.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
            const input = e.currentTarget;
            const start = input.selectionStart ?? 0;
            const end = input.selectionEnd ?? 0;
            const before = input.value.substring(0, start);
            const after = input.value.substring(end);
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value',
            )?.set;
            nativeInputValueSetter?.call(input, before + cleaned + after);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }}
        {...props}
      />
    );
  },
);
IntegerInput.displayName = 'IntegerInput';
