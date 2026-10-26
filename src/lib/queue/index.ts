import { MemoryQueue } from "./memory-queue.ts";
import { auditLogJobHandler } from "./handlers/audit-log-handler.ts";
import { matchingRecalcJobHandler } from "./handlers/matching-recalc-handler.ts";
import { notificationJobHandler } from "./handlers/notification-handler.ts";
import type { QueueJob, JobHandler, QueueStats } from "./types.ts";

let globalQueueInstance: MemoryQueue | null = null;

/**
 * Returns the active background job queue singleton,
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
 * Convenience functional exports for dispatching background tasks
 */
export async function enqueueJob<T>(
  type: string,
  payload: T,
  optionsOrRetries?: number | { maxRetries?: number; priority?: import("./types.ts").JobPriority }
): Promise<QueueJob<T>> {
  return getBackgroundQueue().enqueue<T>(type, payload, optionsOrRetries);
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
}

export * from "./types.ts";
export * from "./memory-queue.ts";
export * from "./handlers/audit-log-handler.ts";
export * from "./handlers/matching-recalc-handler.ts";
export * from "./handlers/notification-handler.ts";
