import type { JobHandler } from "../types.ts";
import { getAuditRepository } from "@/lib/repository";

export interface AuditLogJobPayload {
  actorType: "admin" | "candidate" | "system";
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Background worker handler to asynchronously persist audit log entries
 * without blocking critical HTTP request cycles.
 */
export const auditLogJobHandler: JobHandler<AuditLogJobPayload> = async (job) => {
  const auditRepo = getAuditRepository();
  const payload = job.payload;

  await auditRepo.logEvent({
    actorType: payload.actorType,
    actorId: payload.actorId,
    action: payload.action,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    metadata: {
      ...payload.metadata,
      asyncJobId: job.id,
      jobAttempt: job.attempts,
      userAgent: payload.userAgent,
    },
    ipAddress: payload.ipAddress,
  });
};
