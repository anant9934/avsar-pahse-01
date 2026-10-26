import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentMagicBytes } from "../../src/lib/storage/magic-bytes.ts";

test("Unit: validateDocumentMagicBytes validates genuine PDF signatures", () => {
  const genuinePdf = Buffer.from("%PDF-1.4\n%...\n");
  assert.equal(validateDocumentMagicBytes(genuinePdf, ".pdf"), true);
});

test("Unit: validateDocumentMagicBytes validates genuine DOCX ZIP signatures", () => {
  const genuineDocx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  assert.equal(validateDocumentMagicBytes(genuineDocx, ".docx"), true);
});

test("Unit: validateDocumentMagicBytes rejects disguised shell scripts and executables", () => {
  const fakePdfScript = Buffer.from("#!/bin/bash\necho 'payload'");
  assert.equal(validateDocumentMagicBytes(fakePdfScript, ".pdf"), false);

  const fakePdfExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ executable header
  assert.equal(validateDocumentMagicBytes(fakePdfExe, ".pdf"), false);
});
