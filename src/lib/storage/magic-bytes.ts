/**
 * Validates document content by magic bytes signature.
 * Prevents disguised executable files from being accepted.
 */
export function validateDocumentMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;

  const lowerExt = ext.toLowerCase();

  // PDF signature: %PDF-
  if (lowerExt === ".pdf") {
    const header = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1");
    return header.includes("%PDF-");
  }

  // DOCX (ZIP archive signature): PK\x03\x04
  if (lowerExt === ".docx") {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  // DOC (legacy compound binary): 0xD0 0xCF 0x11 0xE0
  if (lowerExt === ".doc") {
    return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  }

  return false;
}
