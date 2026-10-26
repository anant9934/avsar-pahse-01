/**
 * Caching Layer Type Definitions for Avsar High-Concurrency Architecture
 */

export interface CacheEntry<T = unknown> {
  data: T;
  createdAt: number;
  expiresAt: number;
  staleUntil?: number;
  tags: string[];
}

export interface CacheOptions {
  /** Time to live in seconds */
  ttlSeconds?: number;
  /** Tags for bulk invalidation (e.g. ['jobs', 'jobs:detail:123']) */
  tags?: string[];
  /** Grace window in seconds where stale data can be served while background fetch runs */
  staleWhileRevalidateSeconds?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  itemCount: number;
  hitRatio: number;
}

export interface CacheProvider {
  name: "memory" | "redis";
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  purgeTag(tag: string): Promise<number>;
  flush(): Promise<void>;
  getStats(): CacheStats;
  getOrSet<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T>;
}
