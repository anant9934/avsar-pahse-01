import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkArray, createPayloadChunkStream } from "../src/lib/streaming/payload-chunker.ts";

describe("Payload Chunker & Stream Emitter", () => {
  it("chunks arrays evenly into specified chunk sizes", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const chunks = chunkArray(items, 2);

    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks[0], [1, 2]);
    assert.deepEqual(chunks[1], [3, 4]);
    assert.deepEqual(chunks[2], [5, 6]);
  });

  it("handles remainder items in the final chunk", () => {
    const items = ["a", "b", "c", "d", "e"];
    const chunks = chunkArray(items, 2);

    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks[0], ["a", "b"]);
    assert.deepEqual(chunks[1], ["c", "d"]);
    assert.deepEqual(chunks[2], ["e"]);
  });

  it("throws descriptive error if chunkSize is zero or negative", () => {
    assert.throws(() => chunkArray([1, 2, 3], 0), {
      message: /chunkSize must be greater than 0/,
    });
    assert.throws(() => chunkArray([1, 2, 3], -5), {
      message: /chunkSize must be greater than 0/,
    });
  });

  it("streams NDJSON lines over a WHATWG ReadableStream", async () => {
    const testItems = [
      { id: "item_1", name: "Alpha" },
      { id: "item_2", name: "Beta" },
      { id: "item_3", name: "Gamma" },
    ];

    const stream = createPayloadChunkStream(testItems, { chunkSize: 2 });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
    }

    const lines = output.trim().split("\n");
    assert.equal(lines.length, 2);

    const firstBatch = JSON.parse(lines[0]);
    assert.equal(firstBatch.length, 2);
    assert.equal(firstBatch[0].id, "item_1");
    assert.equal(firstBatch[1].id, "item_2");

    const secondBatch = JSON.parse(lines[1]);
    assert.equal(secondBatch.length, 1);
    assert.equal(secondBatch[0].id, "item_3");
  });
});
