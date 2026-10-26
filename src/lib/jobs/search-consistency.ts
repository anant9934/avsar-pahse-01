import { cachePurgeTag } from "../cache/index.ts";

export interface SearchQueryClause {
  sql: string;
  values: unknown[];
  nextParamIndex: number;
}

/**
 * Builds an authoritative PostgreSQL search predicate combining Full-Text Search (GIN)
 * with substring pattern matching fallback.
 * 
 * Ensures search results are always consistent with live database state across serverless instances,
 * eliminating stale process-local inverted index drifts.
 */
export function buildPostgresSearchClause(searchTerm: string, paramStartIndex = 1): SearchQueryClause {
  if (!searchTerm || typeof searchTerm !== "string" || searchTerm.trim() === "") {
    return {
      sql: "",
      values: [],
      nextParamIndex: paramStartIndex,
    };
  }

  const clean = searchTerm.trim().toLowerCase();
  const pattern = `%${clean}%`;

  // FTS query with plainto_tsquery + substring match fallback
  const sql = `(
    to_tsvector('english', title || ' ' || company) @@ plainto_tsquery('english', $${paramStartIndex})
    OR LOWER(title) LIKE $${paramStartIndex + 1}
    OR LOWER(company) LIKE $${paramStartIndex + 1}
    OR LOWER(location) LIKE $${paramStartIndex + 1}
    OR LOWER(COALESCE(category, '')) LIKE $${paramStartIndex + 1}
  )`;

  return {
    sql,
    values: [clean, pattern],
    nextParamIndex: paramStartIndex + 2,
  };
}

/**
 * Evaluates whether an in-memory or ephemeral search index is within an acceptable freshness window.
 * If older than maxAgeMs, callers must bypass the index and query authoritative PostgreSQL directly.
 */
export function isSearchIndexStale(lastIndexedTimeMs: number, maxAgeMs = 300000): boolean {
  if (!lastIndexedTimeMs || lastIndexedTimeMs <= 0) return true;
  return Date.now() - lastIndexedTimeMs > maxAgeMs;
}

/**
 * Executes write-through invalidation of search caches upon job mutations,
 * imports, status changes, or deactivations.
 */
export async function invalidateSearchCaches(jobId?: string): Promise<number> {
  const tags = ["jobs", "jobs:search", "jobs:raw"];
  if (jobId) {
    tags.push(`job:${jobId}`);
  }

  let totalPurged = 0;
  for (const tag of tags) {
    try {
      totalPurged += await cachePurgeTag(tag);
    } catch (err) {
      console.warn(`[Search Invalidation Warning] Failed purging tag ${tag}:`, err);
    }
  }

  return totalPurged;
}
