import React from 'react';
import { Input, type InputProps } from '@erp/ui';

export interface SearchInputProps extends InputProps {
  wrapperClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ wrapperClassName = '', className, ...props }, ref) => {
    return (
      <div className={`relative flex-1 ${wrapperClassName}`}>
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <Input
          ref={ref}
          type="text"
          className={`pl-10 ${className || ''}`}
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
