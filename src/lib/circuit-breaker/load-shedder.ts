export type RequestPriority = "critical" | "standard" | "low";

export interface LoadShedderOptions {
  maxConcurrency?: number;
  lowPriorityThresholdPercent?: number; // Concurrency % at which to drop 'low' priority
  standardPriorityThresholdPercent?: number; // Concurrency % at which to drop 'standard' priority
}

export class LoadSheddingError extends Error {
  constructor(message = "Service is experiencing high concurrency. Request shed.") {
    super(message);
    this.name = "LoadSheddingError";
  }
}

export class LoadShedder {
  private activeConcurrency = 0;
  private totalAcquired = 0;
  private totalShed = 0;
  private readonly maxConcurrency: number;
  private readonly lowThreshold: number;
  private readonly standardThreshold: number;

  constructor(options: LoadShedderOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 500;
    const lowPct = options.lowPriorityThresholdPercent ?? 75;
    const stdPct = options.standardPriorityThresholdPercent ?? 90;

    this.lowThreshold = Math.floor((this.maxConcurrency * lowPct) / 100);
    this.standardThreshold = Math.floor((this.maxConcurrency * stdPct) / 100);
  }

  /**
   * Evaluates if a request of given priority should be admitted based on current concurrency.
   */
  shouldShed(priority: RequestPriority): boolean {
    if (this.activeConcurrency >= this.maxConcurrency) {
      return true;
    }

    if (priority === "low" && this.activeConcurrency >= this.lowThreshold) {
      return true;
    }

    if (priority === "standard" && this.activeConcurrency >= this.standardThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Attempts to acquire execution capacity for a prioritized request.
   * Returns a release handle if admitted.
   */
  acquire(priority: RequestPriority): { allowed: boolean; release: () => void } {
    if (this.shouldShed(priority)) {
      this.totalShed++;
      return { allowed: false, release: () => {} };
    }

    this.activeConcurrency++;
    this.totalAcquired++;
    let released = false;

    return {
      allowed: true,
      release: () => {
        if (!released) {
          released = true;
          this.activeConcurrency = Math.max(0, this.activeConcurrency - 1);
        }
      },
    };
  }

  /**
   * Executes an asynchronous task protected by adaptive load shedding.
   */
  async execute<T>(
    priority: RequestPriority,
    task: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    const permit = this.acquire(priority);

    if (!permit.allowed) {
      if (fallback) {
        return fallback();
      }
      throw new LoadSheddingError(
        `High concurrency threshold reached for ${priority} priority requests.`
      );
    }

    try {
      return await task();
    } finally {
      permit.release();
    }
  }

  getMetrics() {
    return {
      activeConcurrency: this.activeConcurrency,
      maxConcurrency: this.maxConcurrency,
      totalAcquired: this.totalAcquired,
      totalShed: this.totalShed,
    };
  }

  reset(): void {
    this.activeConcurrency = 0;
    this.totalAcquired = 0;
    this.totalShed = 0;
  }
}

// Global singleton instance for application concurrency protection
let globalShedder: LoadShedder | null = null;

export function getGlobalLoadShedder(options?: LoadShedderOptions): LoadShedder {
  if (!globalShedder) {
    globalShedder = new LoadShedder(options);
  }
  return globalShedder;
}

export function resetGlobalLoadShedder(): void {
  if (globalShedder) {
    globalShedder.reset();
  }
}
