import test from "node:test";
import assert from "node:assert/strict";
import {
  generateETag,
  isNotModified,
  buildCacheControlHeader,
} from "../src/lib/cache/http-cache.ts";

test("HTTP Cache: generateETag produces valid RFC weak ETags", () => {
  const payload1 = { jobs: [{ id: "job_1", title: "Software Engineer" }] };
  const payload2 = { jobs: [{ id: "job_1", title: "Software Engineer" }] };
  const payload3 = { jobs: [{ id: "job_2", title: "Data Scientist" }] };

  const etag1 = generateETag(payload1);
  const etag2 = generateETag(payload2);
  const etag3 = generateETag(payload3);

  assert.match(etag1, /^W\/"[a-f0-9]{16}"$/, "ETag should follow RFC weak format");
  assert.equal(etag1, etag2, "Identical payloads must yield identical ETags");
  assert.notEqual(etag1, etag3, "Differing payloads must produce different ETags");
});

test("HTTP Cache: isNotModified evaluates If-None-Match headers accurately", () => {
  const etag = 'W/"9f82d1c6e4a2b103"';

  // Exact match with W/ prefix
  const h1 = new Headers({ "if-none-match": 'W/"9f82d1c6e4a2b103"' });
  assert.equal(isNotModified(h1, etag), true);

  // Match without W/ prefix
  const h2 = new Headers({ "if-none-match": '"9f82d1c6e4a2b103"' });
  assert.equal(isNotModified(h2, etag), true);

  // Wildcard match
  const h3 = new Headers({ "if-none-match": "*" });
  assert.equal(isNotModified(h3, etag), true);

  // Comma-separated list with match
  const h4 = new Headers({ "if-none-match": '"old-etag", W/"9f82d1c6e4a2b103", "another"' });
  assert.equal(isNotModified(h4, etag), true);

  // Non-matching ETag
  const h5 = new Headers({ "if-none-match": '"different-tag"' });
  assert.equal(isNotModified(h5, etag), false);

  // Missing header
  const h6 = new Headers();
  assert.equal(isNotModified(h6, etag), false);
});

test("HTTP Cache: buildCacheControlHeader formats CDN & Edge caching directives", () => {
  // Edge public cache with stale-while-revalidate
  const edgeHeader = buildCacheControlHeader({
    maxAge: 0,
    sMaxAge: 60,
    staleWhileRevalidate: 120,
  });
  assert.equal(edgeHeader, "public, max-age=0, s-maxage=60, stale-while-revalidate=120");

  // Private non-cacheable
  const privateHeader = buildCacheControlHeader({ isPrivate: true });
  assert.equal(privateHeader, "private, no-cache, no-store, must-revalidate");

  // Must-revalidate option
  const revalidateHeader = buildCacheControlHeader({ maxAge: 300, mustRevalidate: true });
  assert.equal(revalidateHeader, "public, max-age=300, must-revalidate");
});
