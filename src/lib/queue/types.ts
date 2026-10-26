/**
 * High-concurrency background job queue and event bus type definitions.
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface QueueJob<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
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
