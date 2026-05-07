import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the provided value.
 * The debounced value only updates after the specified delay
 * has elapsed since the last change to the input value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
