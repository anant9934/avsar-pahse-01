import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeSSEMessage,
  createSSEStreamHeaders,
  chunkArray,
  createPayloadChunkStream,
} from "../src/lib/streaming/index.ts";

describe("Unified Streaming & Server-Sent Events Integration", () => {
  it("verifies all public exports are defined on facade", () => {
    assert.equal(typeof encodeSSEMessage, "function");
    assert.equal(typeof createSSEStreamHeaders, "function");
    assert.equal(typeof chunkArray, "function");
    assert.equal(typeof createPayloadChunkStream, "function");
  });

  it("constructs valid Web API Response with SSE headers and ReadableStream", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(encodeSSEMessage({ data: "start" })));
        controller.enqueue(encoder.encode(encodeSSEMessage({ event: "complete", data: "done" })));
        controller.close();
      },
    });

    const headers = createSSEStreamHeaders();
    const response = new Response(stream, { headers, status: 200 });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "text/event-stream; charset=utf-8");

    const text = await response.text();
    assert.ok(text.includes("data: start\n\n"));
    assert.ok(text.includes("event: complete\ndata: done\n\n"));
  });

  it("constructs valid NDJSON response stream from chunked array", async () => {
    const dataset = [
      { id: "job_1", title: "Frontend Intern" },
      { id: "job_2", title: "Backend Engineer" },
      { id: "job_3", title: "DevOps Specialist" },
    ];

    const stream = createPayloadChunkStream(dataset, { chunkSize: 2 });
    const response = new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
      status: 200,
    });

    assert.equal(response.status, 200);
    const bodyText = await response.text();
    const lines = bodyText.trim().split("\n");

    assert.equal(lines.length, 2);
    const batch1 = JSON.parse(lines[0]);
    const batch2 = JSON.parse(lines[1]);

    assert.equal(batch1.length, 2);
    assert.equal(batch2.length, 1);
    assert.equal(batch1[0].id, "job_1");
    assert.equal(batch2[0].id, "job_3");
  });
});
