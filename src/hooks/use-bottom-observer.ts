'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Calls `onHit` once whenever a sentinel element scrolls into view. Pair
 * with `useInfiniteQuery` for cursor-based infinite scroll.
 *
 * Returns a callback ref (not a RefObject) so the observer attaches the
 * moment the sentinel mounts — including when it appears later via
 * conditional rendering (e.g. after `isLoading` flips to false). A plain
 * useRef + useEffect would miss the late appearance and leave infinite
 * scroll dead on the first render of the page.
 *
 * Usage:
 *   const sentinelRef = useBottomObserver(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); });
 *   <div ref={sentinelRef} />
 */
export function useBottomObserver(onHit: () => void) {
  const cb = useRef(onHit);
  cb.current = onHit;

  const observerRef = useRef<IntersectionObserver | null>(null);

  const setRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (el) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) cb.current();
        },
        { rootMargin: '160px 0px' },
      );
      io.observe(el);
      observerRef.current = io;
    }
  }, []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return setRef;
}
