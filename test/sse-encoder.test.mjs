import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeSSEMessage, createSSEStreamHeaders } from "../src/lib/streaming/sse-encoder.ts";

describe("Server-Sent Events (SSE) Encoder & Headers", () => {
  it("encodes basic string data into standard SSE event block", () => {
    const raw = encodeSSEMessage({ data: "ping" });
    assert.equal(raw, "data: ping\n\n");
  });

  it("encodes structured JSON data objects automatically", () => {
    const payload = { status: "processing", progress: 75 };
    const raw = encodeSSEMessage({ data: payload });
    assert.equal(raw, `data: {"status":"processing","progress":75}\n\n`);
  });

  it("formats event name, message ID, and retry intervals", () => {
    const raw = encodeSSEMessage({
      id: "evt_123",
      event: "progress_update",
      retry: 5000,
      data: "uploading",
    });

    assert.equal(
      raw,
      "id: evt_123\nevent: progress_update\nretry: 5000\ndata: uploading\n\n"
    );
  });

  it("prefixes each line of a multi-line data string with data: per WHATWG spec", () => {
    const multiLine = "Line 1: Log header\nLine 2: Details\nLine 3: Finished";
    const raw = encodeSSEMessage({ data: multiLine });

    assert.equal(
      raw,
      "data: Line 1: Log header\ndata: Line 2: Details\ndata: Line 3: Finished\n\n"
    );
  });

  it("provides standard edge streaming headers disabling proxy buffering", () => {
    const headers = createSSEStreamHeaders();

    assert.equal(headers["Content-Type"], "text/event-stream; charset=utf-8");
    assert.ok(headers["Cache-Control"].includes("no-cache"));
    assert.ok(headers["Cache-Control"].includes("no-transform"));
    assert.equal(headers["Connection"], "keep-alive");
    assert.equal(headers["X-Accel-Buffering"], "no");
  });
});
