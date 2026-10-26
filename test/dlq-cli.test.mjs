import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runDlqCli } from "../scripts/replay-dlq.mjs";

describe("Dead-Letter Queue SRE CLI Tool", () => {
  it("executes --summary mode cleanly", async () => {
    const result = await runDlqCli(["--summary"]);
    assert.equal(result.success, true);
  });

  it("executes --inspect mode with limit and job type filter", async () => {
    const result = await runDlqCli(["--inspect", "--type=audit_log", "--limit=5"]);
    assert.equal(result.success, true);
  });

  it("executes --replay in --dry-run mode without mutating data", async () => {
    const result = await runDlqCli(["--replay", "--dry-run", "--type=notification", "--limit=10"]);
    assert.equal(result.success, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.replayed, 0);
  });
});
