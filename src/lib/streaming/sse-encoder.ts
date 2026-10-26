import type { SSEMessage } from "./types.ts";

/**
 * Encodes an SSE message object according to the W3C / WHATWG EventSource specification.
 * Handles multi-line strings, structured JSON payloads, optional event names, and IDs.
 */
export function encodeSSEMessage(message: SSEMessage): string {
  const lines: string[] = [];

  if (message.id !== undefined) {
    lines.push(`id: ${message.id}`);
  }

  if (message.event !== undefined) {
    lines.push(`event: ${message.event}`);
  }

  if (message.retry !== undefined) {
    lines.push(`retry: ${message.retry}`);
  }

  // Format data payload
  let rawData = "";
  if (typeof message.data === "string") {
    rawData = message.data;
  } else {
    rawData = JSON.stringify(message.data);
  }

  // Spec requires splitting multi-line data so each line begins with "data: "
  const dataLines = rawData.split(/\r?\n/);
  for (const line of dataLines) {
    lines.push(`data: ${line}`);
  }

  // Double newline signifies end of event block in SSE standard
  return lines.join("\n") + "\n\n";
}

/**
 * Standard HTTP response headers for Server-Sent Events in serverless edge environments.
 */
export function createSSEStreamHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "private, no-cache, no-store, no-transform, must-revalidate",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disables buffering in reverse proxies and CDNs
  };
}
