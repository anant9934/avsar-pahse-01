import type { JobHandler } from "../types.ts";

export interface NotificationJobPayload {
  recipientType: "candidate" | "admin";
  recipientId: string;
  title: string;
  message: string;
  channel: "in_app" | "email" | "webhook";
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Background worker handler that formats and dispatches notifications
 * asynchronously without impeding caller request latencies.
 */
export const notificationJobHandler: JobHandler<NotificationJobPayload> = async (job) => {
  const { recipientType, recipientId, title, channel, link } = job.payload;

  // In production, integrate external transactional email (Resend / SendGrid)
  // or WebSocket in-app notification publisher.
  if (process.env.NODE_ENV !== "test") {
    console.info(
      `[Async Notification Worker] Dispatched ${channel} alert to ${recipientType}:${recipientId} - "${title}" (${link || "no-link"})`
    );
  }
};
