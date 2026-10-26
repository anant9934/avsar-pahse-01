import { randomUUID } from "node:crypto";
import type { QueueJob, JobHandler, QueueOptions, QueueStats } from "./types.ts";

/**
 * High-concurrency In-Memory Asynchronous Job Queue.
 * Supports configurable worker concurrency, exponential backoff retries,
 * and a dead-letter queue (DLQ) for poison messages.
 */
export class MemoryQueue {
  private handlers = new Map<string, JobHandler>();
  private pending: QueueJob[] = [];
  private processing = new Map<string, QueueJob>();
  private deadLetterQueue: QueueJob[] = [];
  private completedCount = 0;
  private failedCount = 0;
  private delayedCount = 0;

  private concurrency: number;
  private maxRetries: number;
  private backoffMs: number;
  private isProcessingLoopActive = false;

  constructor(options?: QueueOptions) {
    this.concurrency = options?.concurrency || 5;
    this.maxRetries = options?.maxRetries || 3;
    this.backoffMs = options?.backoffMs || 100;
  }

  /**
   * Registers a dedicated worker handler for a specific job type.
   */
  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Enqueues an asynchronous background job.
   */
  async enqueue<T>(type: string, payload: T, maxRetriesOverride?: number): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: `job_${randomUUID()}`,
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: maxRetriesOverride ?? this.maxRetries,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.pending.push(job as QueueJob);
    // Non-blocking trigger of worker loop
    queueMicrotask(() => this.triggerWorkerLoop());

    return job;
  }

  /**
   * Workers loop: pops available jobs up to the concurrency limit.
   */
  private async triggerWorkerLoop(): Promise<void> {
    if (this.isProcessingLoopActive) return;
    this.isProcessingLoopActive = true;

    try {
      while (this.pending.length > 0 && this.processing.size < this.concurrency) {
        const job = this.pending.shift();
        if (!job) break;

        this.processJob(job);
      }
    } finally {
      this.isProcessingLoopActive = false;
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = "failed";
      job.failedReason = `No handler registered for job type: ${job.type}`;
      this.deadLetterQueue.push(job);
      this.failedCount++;
      return;
    }

    job.status = "processing";
    job.attempts++;
    job.updatedAt = Date.now();
    this.processing.set(job.id, job);

    try {
      await handler(job);
      job.status = "completed";
      job.updatedAt = Date.now();
      this.completedCount++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      job.failedReason = errMsg;

      if (job.attempts < job.maxAttempts) {
        // Exponential backoff delay before re-enqueuing
        this.delayedCount++;
        const delay = this.backoffMs * Math.pow(2, job.attempts - 1);
        setTimeout(() => {
          this.delayedCount--;
          job.status = "pending";
          this.pending.push(job);
          this.triggerWorkerLoop();
        }, delay);
      } else {
        // Exceeded retries: send to dead letter queue
        job.status = "failed";
        this.deadLetterQueue.push(job);
        this.failedCount++;
      }
    } finally {
      this.processing.delete(job.id);
      // Spawn next job in queue
      this.triggerWorkerLoop();
    }
  }

  /**
   * Awaits completion of all currently pending and active jobs.
   */
  async drain(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (this.pending.length > 0 || this.processing.size > 0 || this.delayedCount > 0) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Queue drain timed out after ${timeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  getStats(): QueueStats {
    return {
      pendingCount: this.pending.length,
      processingCount: this.processing.size,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      deadLetterCount: this.deadLetterQueue.length,
    };
  }

  getDeadLetterJobs(): QueueJob[] {
    return [...this.deadLetterQueue];
  }

  clear(): void {
    this.pending = [];
    this.processing.clear();
    this.deadLetterQueue = [];
    this.completedCount = 0;
    this.failedCount = 0;
    this.delayedCount = 0;
  }
}
