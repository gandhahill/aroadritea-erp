'use client';

import { forwardRef, useCallback, useRef, useState } from 'react';
import { cn } from './utils';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  /** Controlled raw numeric value (no separators). */
  value?: string;
  /** Called with the raw numeric string (no dots/commas). */
  onValueChange?: (raw: string) => void;
  /** Also expose native onChange for uncontrolled forms. */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Currency prefix shown inside the input. Default: "Rp" */
  prefix?: string;
}

const baseInputStyles =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5 disabled:opacity-50 disabled:cursor-not-allowed';

/** Format a raw numeric string with Indonesian thousand separators (dots). */
function formatWithDots(raw: string): string {
  if (!raw) return '';
  // Remove everything except digits and minus sign at start
  const clean = raw.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
  if (!clean || clean === '-') return clean;

  const isNegative = clean.startsWith('-');
  const digits = isNegative ? clean.slice(1) : clean;
  // Add thousand separators
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-${formatted}` : formatted;
}

/** Strip dots to get raw numeric string. */
function stripDots(formatted: string): string {
  return formatted.replace(/\./g, '');
}

/**
 * Money input that auto-formats with Indonesian thousand separators (dots)
 * as the user types. The underlying form value is the raw number without dots.
 *
 * Works with both controlled (value + onValueChange) and uncontrolled
 * (defaultValue + name for FormData) patterns.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    { className, value, defaultValue, onValueChange, onChange, prefix = 'Rp', name, ...props },
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState(() =>
      formatWithDots(String(defaultValue ?? '')),
    );
    const hiddenRef = useRef<HTMLInputElement>(null);

    // Controlled vs uncontrolled display value
    const displayValue = value !== undefined ? formatWithDots(value) : internalValue;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawInput = e.target.value;
        // Allow only digits, dots (as separators), and leading minus
        const raw = stripDots(rawInput);

        // Validate: only digits (with optional leading minus)
        if (raw !== '' && raw !== '-' && !/^-?\d+$/.test(raw)) return;

        const formatted = formatWithDots(raw);

        if (value === undefined) {
          setInternalValue(formatted);
        }

        onValueChange?.(raw);

        // Fire native onChange with the raw value in the hidden input
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: raw, name: name ?? '' },
            currentTarget: { ...e.currentTarget, value: raw, name: name ?? '' },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      },
      [value, onValueChange, onChange, name],
    );

    return (
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink-3">
            {prefix}
          </span>
        ) : null}
        {/* Hidden input carries the raw numeric value for FormData */}
        <input type="hidden" name={name} value={stripDots(displayValue)} readOnly />
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          className={cn(
            baseInputStyles,
            prefix ? 'pl-9' : '',
            'text-right tabular-nums',
            className,
          )}
          value={displayValue}
          onChange={handleChange}
          autoComplete="off"
          {...props}
          // Remove name so form doesn't submit the formatted value
          name={undefined}
        />
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
