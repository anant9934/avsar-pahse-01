import type { CacheProvider, CacheOptions, CacheStats } from "./types.ts";
import { MemoryCacheProvider } from "./memory-cache.ts";
import { RedisCacheProvider } from "./redis-provider.ts";

let globalCacheInstance: CacheProvider | null = null;

/**
 * Returns the active application-level cache provider.
 * Instantiates a RedisCacheProvider if Upstash credentials are configured,
 * otherwise defaults to high-concurrency LRU MemoryCacheProvider with stampede protection.
 */
export function getCacheManager(): CacheProvider {
  if (!globalCacheInstance) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      globalCacheInstance = new RedisCacheProvider();
    } else {
      globalCacheInstance = new MemoryCacheProvider();
    }
  }
  return globalCacheInstance;
}

/**
 * Convenience functional exports for caching operations
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  return getCacheManager().get<T>(key);
}

export async function cacheSet<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
  return getCacheManager().set<T>(key, value, options);
}

export async function cacheDelete(key: string): Promise<boolean> {
  return getCacheManager().delete(key);
}

export async function cachePurgeTag(tag: string): Promise<number> {
  return getCacheManager().purgeTag(tag);
}

export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  return getCacheManager().getOrSet<T>(key, fetcher, options);
}

export function getCacheStats(): CacheStats {
  return getCacheManager().getStats();
}

/**
 * Reset cache manager instance (useful for unit testing isolation)
 */
export function resetCacheManagerForTesting(mockProvider?: CacheProvider): void {
  globalCacheInstance = mockProvider || null;
}

export * from "./types.ts";
export * from "./key-generator.ts";
export * from "./memory-cache.ts";
export * from "./redis-provider.ts";
export * from "./http-cache.ts";
