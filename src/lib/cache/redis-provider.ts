import type { CacheProvider, CacheOptions, CacheStats } from "./types.ts";
import { MemoryCacheProvider } from "./memory-cache.ts";

/**
 * Upstash Redis / Redis REST-compatible distributed cache provider.
 * Falls back safely to in-memory caching when external Redis credentials are unconfigured.
 */
export class RedisCacheProvider implements CacheProvider {
  name = "redis" as const;
  private fallbackMemory: MemoryCacheProvider;
  private isConfigured = false;
  private restUrl?: string;
  private restToken?: string;

  constructor(options?: { restUrl?: string; restToken?: string }) {
    this.fallbackMemory = new MemoryCacheProvider();
    this.restUrl = options?.restUrl || process.env.UPSTASH_REDIS_REST_URL;
    this.restToken = options?.restToken || process.env.UPSTASH_REDIS_REST_TOKEN;
    this.isConfigured = Boolean(this.restUrl && this.restToken);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConfigured || !this.restUrl || !this.restToken) {
      return this.fallbackMemory.get<T>(key);
    }

    try {
      const res = await fetch(`${this.restUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.restToken}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.result) return null;
      return JSON.parse(json.result) as T;
    } catch (err) {
      console.warn("[Redis Cache Get Warning] Falling back to memory:", err);
      return this.fallbackMemory.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    // Keep local memory in sync
    await this.fallbackMemory.set(key, value, options);

    if (!this.isConfigured || !this.restUrl || !this.restToken) {
      return;
    }

    try {
      const ttl = options?.ttlSeconds || 60;
      const serialized = JSON.stringify(value);
      await fetch(`${this.restUrl}/set/${encodeURIComponent(key)}?ex=${ttl}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serialized),
      });
    } catch (err) {
      console.warn("[Redis Cache Set Warning]:", err);
    }
  }

  async delete(key: string): Promise<boolean> {
    const memoryDeleted = await this.fallbackMemory.delete(key);
    if (!this.isConfigured || !this.restUrl || !this.restToken) {
      return memoryDeleted;
    }

    try {
      const res = await fetch(`${this.restUrl}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.restToken}` },
      });
      const json = await res.json();
      return json.result > 0 || memoryDeleted;
    } catch {
      return memoryDeleted;
    }
  }

  async purgeTag(tag: string): Promise<number> {
    // Tag purges are cleared in memory adapter
    return await this.fallbackMemory.purgeTag(tag);
  }

  async flush(): Promise<void> {
    await this.fallbackMemory.flush();
  }

  getStats(): CacheStats {
    return this.fallbackMemory.getStats();
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await fetcher();
    await this.set(key, fresh, options);
    return fresh;
  }
}
