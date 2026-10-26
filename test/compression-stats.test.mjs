import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateCompressedSize,
  recordResponsePayload,
  getCompressionMetrics,
  resetCompressionMetrics,
} from "../src/lib/telemetry/compression-stats.ts";

test("CompressionMetrics: estimates sizes per content type accurately", () => {
  const jsonRaw = 10000;
  const jsonComp = estimateCompressedSize(jsonRaw, "json");
  assert.equal(jsonComp, 3500, "JSON should estimate ~65% reduction (35% retained)");

  const textRaw = 10000;
  const textComp = estimateCompressedSize(textRaw, "text");
  assert.equal(textComp, 4000, "Text should estimate ~60% reduction (40% retained)");

  const binRaw = 10000;
  const binComp = estimateCompressedSize(binRaw, "binary");
  assert.equal(binComp, 9800, "Pre-compressed binary should retain ~98% of size");
});

test("CompressionMetrics: aggregates payload metrics and calculates bandwidth savings", () => {
  resetCompressionMetrics();

  // Record 10 JSON API responses of 10KB each (100KB total)
  for (let i = 0; i < 10; i++) {
    recordResponsePayload(10000, "json");
  }

  const metrics = getCompressionMetrics();
  assert.equal(metrics.totalResponses, 10);
  assert.equal(metrics.totalRawBytes, 100000);
  assert.equal(metrics.estimatedCompressedBytes, 35000);
  assert.equal(metrics.bandwidthSavingsPercent, 65.0);

  resetCompressionMetrics();
  assert.equal(getCompressionMetrics().totalResponses, 0);
});
