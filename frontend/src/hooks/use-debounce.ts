import { useState, useEffect } from "react";

/**
 * useDebounce Hook
 * @param value - The input value to debounce (string, number, etc.)
 * @param delay - Delay in milliseconds before updating the debounced value
 * @returns Debounced value that updates only after delay passes
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup timeout on unmount or value change
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
