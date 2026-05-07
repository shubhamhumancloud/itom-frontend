'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `onHit` once whenever a sentinel element scrolls into view. Pair
 * with `useInfiniteQuery` for cursor-based infinite scroll.
 *
 * Usage:
 *   const sentinelRef = useBottomObserver(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); });
 *   <div ref={sentinelRef} />
 */
export function useBottomObserver(onHit: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onHit);
  cb.current = onHit;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) cb.current();
      },
      { rootMargin: '160px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
