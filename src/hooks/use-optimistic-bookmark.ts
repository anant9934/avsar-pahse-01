"use client";

import { useState, useCallback } from "react";

export interface UseOptimisticBookmarkOptions {
  jobId: string;
  initialSaved: boolean;
  onSuccess?: (isSaved: boolean) => void;
  onError?: (err: unknown) => void;
}

/**
 * Optimistic state management hook for candidate saved jobs.
 * Flips bookmark state immediately on click for instant zero-latency feedback,
 * automatically rolling back state if the network request fails.
 */
export function useOptimisticBookmark({
  jobId,
  initialSaved,
  onSuccess,
  onError,
}: UseOptimisticBookmarkOptions) {
  const [isSaved, setIsSaved] = useState<boolean>(initialSaved);
  const [isPending, setIsPending] = useState<boolean>(false);

  const toggleBookmark = useCallback(async () => {
    const previousState = isSaved;
    const nextState = !previousState;

    // Optimistically update UI immediately
    setIsSaved(nextState);
    setIsPending(true);

    try {
      const res = await fetch("/api/jobs/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        throw new Error(`Bookmark request failed with status ${res.status}`);
      }

      const data = await res.json();
      setIsSaved(data.isSaved);
      onSuccess?.(data.isSaved);
    } catch (err) {
      // Rollback to previous state on network failure
      setIsSaved(previousState);
      onError?.(err);
    } finally {
      setIsPending(false);
    }
  }, [jobId, isSaved, onSuccess, onError]);

  return {
    isSaved,
    isPending,
    toggleBookmark,
  };
}
