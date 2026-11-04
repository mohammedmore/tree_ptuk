import { useState, useEffect, useRef, useMemo, useCallback } from "react";

export interface VirtualItem {
  index: number;
  offsetTop: number;
  size: number;
}

export interface UseVirtualizerOptions {
  count: number;
  estimateSize: (index: number) => number;
  overscan?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
  useWindowScroll?: boolean;
}

export interface VirtualizerResult {
  virtualItems: VirtualItem[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
  isScrolling: boolean;
}

/**
 * High-performance virtual scrolling hook designed to maintain 60 FPS
 * on mobile and desktop by rendering only visible DOM nodes.
 */
export function useVirtualizer({
  count,
  estimateSize,
  overscan = 5,
  containerRef,
  useWindowScroll = true,
}: UseVirtualizerOptions): VirtualizerResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Compute cumulative offset positions and item sizes
  const { offsets, sizes, totalHeight } = useMemo(() => {
    const offsets = new Array<number>(count);
    const sizes = new Array<number>(count);
    let currentOffset = 0;

    for (let i = 0; i < count; i++) {
      offsets[i] = currentOffset;
      const size = estimateSize(i);
      sizes[i] = size;
      currentOffset += size;
    }

    return { offsets, sizes, totalHeight: currentOffset };
  }, [count, estimateSize]);

  // Track container offset relative to page if using window scroll
  const getContainerOffsetTop = useCallback((): number => {
    if (!useWindowScroll || !containerRef?.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return window.scrollY + rect.top;
  }, [useWindowScroll, containerRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 150);

        if (useWindowScroll) {
          const containerOffset = getContainerOffsetTop();
          const relativeScroll = Math.max(0, window.scrollY - containerOffset);
          setScrollTop(relativeScroll);
          setViewportHeight(window.innerHeight);
        } else if (containerRef?.current) {
          setScrollTop(containerRef.current.scrollTop);
          setViewportHeight(containerRef.current.clientHeight);
        }
      });
    };

    const target: EventTarget = useWindowScroll
      ? window
      : containerRef?.current || window;
    target.addEventListener("scroll", handleScroll as EventListener, {
      passive: true,
    });
    window.addEventListener("resize", handleScroll, { passive: true });

    // Initial measurement
    handleScroll();

    return () => {
      target.removeEventListener("scroll", handleScroll as EventListener);
      window.removeEventListener("resize", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [useWindowScroll, containerRef, getContainerOffsetTop]);

  // Binary search to find start index
  const startIndex = useMemo(() => {
    if (count === 0) return 0;
    let low = 0;
    let high = count - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const offset = offsets[mid];
      const endOffset = offset + sizes[mid];

      if (endOffset >= scrollTop) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return Math.max(0, Math.min(count - 1, low - overscan));
  }, [count, offsets, sizes, scrollTop, overscan]);

  // Find end index
  const endIndex = useMemo(() => {
    if (count === 0) return 0;
    const bottomBound = scrollTop + viewportHeight;
    let idx = startIndex;

    while (idx < count && offsets[idx] < bottomBound) {
      idx++;
    }

    return Math.min(count - 1, idx + overscan);
  }, [count, offsets, scrollTop, viewportHeight, startIndex, overscan]);

  // Calculate virtual slice
  const virtualItems = useMemo(() => {
    if (count === 0) return [];
    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        offsetTop: offsets[i],
        size: sizes[i],
      });
    }
    return items;
  }, [startIndex, endIndex, offsets, sizes, count]);

  const paddingTop =
    virtualItems.length > 0 ? offsets[virtualItems[0].index] : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalHeight -
        (offsets[virtualItems[virtualItems.length - 1].index] +
          sizes[virtualItems[virtualItems.length - 1].index])
      : 0;

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    paddingTop: Math.max(0, paddingTop),
    paddingBottom: Math.max(0, paddingBottom),
    isScrolling,
  };
}
