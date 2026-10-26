/**
 * Bandwidth and Edge Compression Metrics Tracker.
 * Estimates payload compression ratios and bandwidth savings across high-concurrency endpoints.
 */

export interface CompressionMetrics {
  totalResponses: number;
  totalRawBytes: number;
  estimatedCompressedBytes: number;
  bandwidthSavingsPercent: number;
}

let totalResponses = 0;
let totalRawBytes = 0;
let estimatedCompressedBytes = 0;

/**
 * Typical compression factor based on MIME content type:
 * - JSON: ~65% compression (retained size 35%)
 * - Plain Text / HTML: ~60% compression (retained size 40%)
 * - Binary / PDF / Images: negligible compression (already compressed, retained size 98%)
 */
export function estimateCompressedSize(rawBytes: number, format: "json" | "text" | "binary" = "json"): number {
  if (rawBytes <= 0) return 0;
  if (format === "binary") return Math.round(rawBytes * 0.98);
  if (format === "text") return Math.round(rawBytes * 0.40);
  return Math.round(rawBytes * 0.35); // json
}

export function recordResponsePayload(
  rawBytes: number,
  format: "json" | "text" | "binary" = "json"
): void {
  if (rawBytes <= 0) return;

  totalResponses++;
  totalRawBytes += rawBytes;
  estimatedCompressedBytes += estimateCompressedSize(rawBytes, format);
}

export function getCompressionMetrics(): CompressionMetrics {
  const savings = totalRawBytes > 0
    ? Number((((totalRawBytes - estimatedCompressedBytes) / totalRawBytes) * 100).toFixed(1))
    : 0;

  return {
    totalResponses,
    totalRawBytes,
    estimatedCompressedBytes,
    bandwidthSavingsPercent: savings,
  };
}

export function resetCompressionMetrics(): void {
  totalResponses = 0;
  totalRawBytes = 0;
  estimatedCompressedBytes = 0;
}
