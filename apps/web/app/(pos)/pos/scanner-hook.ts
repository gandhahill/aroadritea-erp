'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A hook to listen for barcode scanner input (which emulates keyboard typing).
 * Barcode scanners typically type very fast and end with an 'Enter' key.
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options = { timeout: 50, minLength: 3 },
) {
  const [buffer, setBuffer] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'Enter') {
        if (buffer.length >= options.minLength) {
          onScan(buffer);
        }
        setBuffer('');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Ignore non-character keys (Shift, Ctrl, etc)
      if (e.key.length === 1) {
        setBuffer((prev) => prev + e.key);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          // If typing pauses for too long, it's probably human, clear buffer
          setBuffer('');
        }, options.timeout);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [buffer, onScan, options.timeout, options.minLength]);
}
