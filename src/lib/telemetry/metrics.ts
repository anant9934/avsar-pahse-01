import type { MetricSnapshot } from "./types.ts";

/**
 * High-concurrency metrics aggregator with bounded memory usage.
 * Maintains a reservoir of recent latency samples and calculates real-time
 * p50, p90, p95, p99 percentiles and rolling throughput (RPS).
 */
export class MetricsCollector {
  private samples = new Map<string, number[]>();
  private requestTimestamps = new Map<string, number[]>();
  private maxReservoirSize: number;

  constructor(maxReservoirSize = 500) {
    this.maxReservoirSize = maxReservoirSize;
  }

  /**
   * Records a latency duration sample in milliseconds for a named operation.
   */
  recordDuration(name: string, durationMs: number): void {
    let list = this.samples.get(name);
    if (!list) {
      list = [];
      this.samples.set(name, list);
    }

    if (list.length >= this.maxReservoirSize) {
      list.shift(); // Evict oldest sample
    }
    list.push(durationMs);

    // Track throughput timestamp
    let timestamps = this.requestTimestamps.get(name);
    if (!timestamps) {
      timestamps = [];
      this.requestTimestamps.set(name, timestamps);
    }
    const now = Date.now();
    timestamps.push(now);
    // Keep only timestamps from last 10 seconds for rolling RPS
    const cutoff = now - 10000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  getSnapshot(name: string): MetricSnapshot {
    const list = this.samples.get(name) || [];
    if (list.length === 0) {
      return {
        name,
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        recentRps: 0,
      };
    }

    const sorted = [...list].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    const percentile = (p: number): number => {
      const idx = Math.min(Math.floor((p / 100) * count), count - 1);
      return parseFloat(sorted[idx].toFixed(2));
    };

    // Calculate rolling RPS (requests / 10s window)
    const timestamps = this.requestTimestamps.get(name) || [];
    const rps = timestamps.length > 0 ? parseFloat((timestamps.length / 10).toFixed(1)) : 0;

    return {
      name,
      count,
      min: parseFloat(sorted[0].toFixed(2)),
      max: parseFloat(sorted[count - 1].toFixed(2)),
      avg: parseFloat((sum / count).toFixed(2)),
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      recentRps: rps,
    };
  }

  getAllSnapshots(): Record<string, MetricSnapshot> {
    const result: Record<string, MetricSnapshot> = {};
    for (const name of this.samples.keys()) {
      result[name] = this.getSnapshot(name);
    }
    return result;
  }

  reset(): void {
    this.samples.clear();
    this.requestTimestamps.clear();
  }
}
