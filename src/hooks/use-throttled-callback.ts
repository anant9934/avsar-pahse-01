"use client";

import { useCallback, useRef } from "react";

/**
 * Custom React hook that creates a throttled callback.
 * Prevents rapid double-clicks on button submissions and forms,
 * ensuring actions only execute once within the specified throttle window.
 */
export function useThrottledCallback<A extends unknown[], R>(
  callback: (...args: A) => R,
  throttleMs = 500
): (...args: A) => R | undefined {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args: A) => {
      const now = Date.now();
      if (now - lastCallRef.current >= throttleMs) {
        lastCallRef.current = now;
        return callbackRef.current(...args);
      }
      return undefined;
    },
    [throttleMs]
  );
}
