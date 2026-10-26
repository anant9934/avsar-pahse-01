"use client";

import { useState, useCallback, useMemo } from "react";

export interface VirtualWindowOptions {
  itemCount: number;
  estimatedItemHeight: number;
  viewportHeight?: number;
  overscan?: number;
}

export interface VirtualSlice {
  startIndex: number;
  endIndex: number;
  topPadding: number;
  bottomPadding: number;
  totalHeight: number;
}

/**
 * Pure calculation function for computing virtualized slice indices and spacer heights.
 */
export function calculateVirtualSlice(
  itemCount: number,
  itemHeight: number,
  scrollTop: number,
  viewportHeight = 800,
  overscan = 3
): VirtualSlice {
  if (itemCount <= 0 || itemHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      topPadding: 0,
      bottomPadding: 0,
      totalHeight: 0,
    };
  }

  const totalHeight = itemCount * itemHeight;
  const rawStart = Math.floor(Math.max(0, scrollTop) / itemHeight);
  const rawEnd = Math.ceil(Math.max(0, scrollTop + viewportHeight) / itemHeight);

  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(itemCount, rawEnd + overscan);

  const topPadding = startIndex * itemHeight;
  const bottomPadding = Math.max(0, (itemCount - endIndex) * itemHeight);

  return {
    startIndex,
    endIndex,
    topPadding,
    bottomPadding,
    totalHeight,
  };
}

/**
 * React hook that manages virtualized list slicing for smooth 60fps scrolling on mobile devices.
 */
export function useVirtualWindow(options: VirtualWindowOptions) {
  const {
    itemCount,
    estimatedItemHeight,
    viewportHeight = 800,
    overscan = 3,
  } = options;

  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((scrollOffset: number) => {
    setScrollTop(Math.max(0, scrollOffset));
  }, []);

  const slice = useMemo(() => {
    return calculateVirtualSlice(
      itemCount,
      estimatedItemHeight,
      scrollTop,
      viewportHeight,
      overscan
    );
  }, [itemCount, estimatedItemHeight, scrollTop, viewportHeight, overscan]);

  return {
    ...slice,
    scrollTop,
    onScroll: handleScroll,
  };
}
