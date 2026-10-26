import type { ChunkOptions } from "./types.ts";

/**
 * Splits an array into smaller chunks of specified size.
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Creates a WHATWG ReadableStream that yields chunks as JSON lines (NDJSON) or binary buffers.
 * Prevents buffering multi-megabyte payloads in serverless function heap memory.
 */
export function createPayloadChunkStream<T>(
  items: T[],
  options: ChunkOptions = {}
): ReadableStream<Uint8Array> {
  const chunkSize = options.chunkSize ?? 50;
  const delayMs = options.delayMs ?? 0;
  const chunks = chunkArray(items, chunkSize);
  const encoder = new TextEncoder();

  let currentChunkIndex = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (currentChunkIndex >= chunks.length) {
        controller.close();
        return;
      }

      const chunk = chunks[currentChunkIndex++];
      const chunkPayload = JSON.stringify(chunk) + "\n";
      controller.enqueue(encoder.encode(chunkPayload));

      if (delayMs > 0 && currentChunkIndex < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    },
  });
}
