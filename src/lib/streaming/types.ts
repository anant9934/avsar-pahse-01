/**
 * Streaming and Server-Sent Events (SSE) Type Definitions
 */

export interface SSEMessage {
  event?: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export interface ChunkOptions {
  chunkSize?: number;
  delayMs?: number;
}

export interface StreamProgressEvent {
  step: string;
  progressPercentage: number;
  detail?: unknown;
  timestamp?: string;
}
