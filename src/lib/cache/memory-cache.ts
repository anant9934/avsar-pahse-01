import type { CacheProvider, CacheOptions, CacheStats, CacheEntry } from "./types.ts";

/**
 * High-concurrency In-Memory LRU Cache with Singleflight Stampede Protection
 * and Tag-based Invalidation.
 */
export class MemoryCacheProvider implements CacheProvider {
  name = "memory" as const;
  private maxItems: number;
  private defaultTtlSeconds: number;
  private entries = new Map<string, CacheEntry<unknown>>();
  private tagIndex = new Map<string, Set<string>>();
  private inFlight = new Map<string, Promise<unknown>>();

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(options?: { maxItems?: number; defaultTtlSeconds?: number }) {
    this.maxItems = options?.maxItems || 1000;
    this.defaultTtlSeconds = options?.defaultTtlSeconds || 60;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      // Key expired
      this.deleteInternal(key);
      this.stats.misses++;
      return null;
    }

    // Refresh LRU order: delete and re-insert key
    this.entries.delete(key);
    this.entries.set(key, entry);

    this.stats.hits++;
    return entry.data as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttlSeconds = options?.ttlSeconds ?? this.defaultTtlSeconds;
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const tags = options?.tags || [];

    // Enforce capacity constraint (LRU eviction of oldest key)
    if (this.entries.size >= this.maxItems && !this.entries.has(key)) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.deleteInternal(oldestKey);
        this.stats.evictions++;
      }
    }

    const entry: CacheEntry<unknown> = {
      data: value,
      createdAt: now,
      expiresAt,
      tags,
    };

    // Store in LRU map
    this.entries.set(key, entry);

    // Index tags
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.deleteInternal(key);
  }

  private deleteInternal(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    // Clean up tag references
    for (const tag of entry.tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(key);
        if (set.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    return this.entries.delete(key);
  }

  async purgeTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) return 0;

    const keysArray = Array.from(keys);
    let count = 0;
    for (const key of keysArray) {
      if (this.deleteInternal(key)) {
        count++;
      }
    }
    this.tagIndex.delete(tag);
    return count;
  }

  async flush(): Promise<void> {
    this.entries.clear();
    this.tagIndex.clear();
    this.inFlight.clear();
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      itemCount: this.entries.size,
      hitRatio: total > 0 ? parseFloat((this.stats.hits / total).toFixed(4)) : 0,
    };
  }

  /**
   * Atomic Get-Or-Set with Singleflight Cache Stampede Protection
   * If multiple concurrent requests target an expired key, only one fetcher executes.
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if another request is already fetching this exact key
    let promise = this.inFlight.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = (async () => {
        try {
          const freshData = await fetcher();
          await this.set(key, freshData, options);
          return freshData;
        } finally {
          this.inFlight.delete(key);
        }
      })();
      this.inFlight.set(key, promise);
    }

    return await promise;
  }
}
