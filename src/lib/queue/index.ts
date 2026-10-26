import { MemoryQueue } from "./memory-queue.ts";
import { PostgresDurableQueue } from "./postgres-queue.ts";
import { isPostgresConfigured } from "../db/postgres.ts";
import { auditLogJobHandler } from "./handlers/audit-log-handler.ts";
import { matchingRecalcJobHandler } from "./handlers/matching-recalc-handler.ts";
import { notificationJobHandler } from "./handlers/notification-handler.ts";
import type { QueueJob, JobHandler, QueueStats, DurableQueueProvider, JobPriority } from "./types.ts";

let globalQueueInstance: MemoryQueue | null = null;
let globalDurableQueueInstance: PostgresDurableQueue | null = null;

/**
 * Returns the active in-memory background job queue singleton,
 * wiring standard worker handlers automatically.
 */
export function getBackgroundQueue(): MemoryQueue {
  if (!globalQueueInstance) {
    globalQueueInstance = new MemoryQueue({
      concurrency: 5,
      maxRetries: 3,
      backoffMs: 50,
    });

    // Register built-in standard handlers
    globalQueueInstance.registerHandler("audit_log", auditLogJobHandler);
    globalQueueInstance.registerHandler("matching_recalc", matchingRecalcJobHandler);
    globalQueueInstance.registerHandler("notification", notificationJobHandler);
  }
  return globalQueueInstance;
}

/**
 * Returns the persistent PostgreSQL-backed durable queue instance.
 */
export function getDurableQueue(): DurableQueueProvider {
  if (!globalDurableQueueInstance) {
    globalDurableQueueInstance = new PostgresDurableQueue();
  }
  return globalDurableQueueInstance;
}

/**
 * Checks whether persistent durable queueing is available in the current environment.
 */
export function isDurableQueueActive(): boolean {
  return isPostgresConfigured();
}

/**
 * Convenience functional exports for dispatching background tasks
 */
export async function enqueueJob<T>(
  type: string,
  payload: T,
  optionsOrRetries?: number | { maxRetries?: number; priority?: JobPriority }
): Promise<QueueJob<T>> {
  return getBackgroundQueue().enqueue<T>(type, payload, optionsOrRetries);
}

/**
 * Dispatches a job requiring durable, persistent background delivery.
 */
export async function enqueueDurableJob<T>(
  type: string,
  payload: T,
  options?: { priority?: JobPriority; maxRetries?: number }
): Promise<QueueJob<T>> {
  return getDurableQueue().enqueue<T>(type, payload, options);
}

export function getQueueStats(): QueueStats {
  return getBackgroundQueue().getStats();
}

export async function drainQueue(timeoutMs = 5000): Promise<void> {
  return getBackgroundQueue().drain(timeoutMs);
}

export function registerJobHandler<T>(type: string, handler: JobHandler<T>): void {
  getBackgroundQueue().registerHandler<T>(type, handler);
}

export function resetQueueForTesting(): void {
  if (globalQueueInstance) {
    globalQueueInstance.clear();
    globalQueueInstance = null;
  }
  globalDurableQueueInstance = null;
}

export * from "./types.ts";
export * from "./memory-queue.ts";
export * from "./postgres-queue.ts";
export * from "./outbox.ts";
export * from "./dead-letter.ts";
export * from "./handlers/audit-log-handler.ts";
export * from "./handlers/matching-recalc-handler.ts";
export * from "./handlers/notification-handler.ts";
