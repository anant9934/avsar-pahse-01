/**
 * High-concurrency background job queue and event bus type definitions.
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type JobPriority = "high" | "normal" | "low";

export interface QueueJob<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
  priority?: JobPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
  failedReason?: string;
}

export type JobHandler<T = unknown> = (job: QueueJob<T>) => Promise<void>;

export interface QueueOptions {
  /** Maximum number of concurrent jobs processed simultaneously */
  concurrency?: number;
  /** Maximum retry attempts for failed jobs before sending to dead letter queue */
  maxRetries?: number;
  /** Base backoff delay in milliseconds for retrying failed jobs */
  backoffMs?: number;
}

export interface QueueStats {
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  deadLetterCount: number;
}

export interface LeasedJob<T = unknown> extends QueueJob<T> {
  leaseId: string;
  leasedUntil: Date;
}

export interface DurableQueueProvider {
  /** Enqueues a job into durable persistent storage */
  enqueue<T = unknown>(
    type: string,
    payload: T,
    options?: { priority?: JobPriority; maxRetries?: number }
  ): Promise<QueueJob<T>>;

  /** Atomically claims up to `limit` jobs using SKIP LOCKED */
  leaseBatch<T = unknown>(
    limit?: number,
    leaseDurationSeconds?: number
  ): Promise<LeasedJob<T>[]>;

  /** Confirms successful job completion and marks it completed */
  ack(jobId: string, leaseId: string): Promise<boolean>;

  /** Rejects job or records failure attempt, transitioning to dead letter on retry exhaustion */
  nack(jobId: string, leaseId: string, errorReason?: string): Promise<boolean>;

  /** Retrieves queue metrics across pending, leased, and dead-letter states */
  getStats(): Promise<QueueStats>;

  /** Replays jobs from dead-letter status back to pending for reprocessing */
  replayDeadLetters(type?: string): Promise<number>;
}
