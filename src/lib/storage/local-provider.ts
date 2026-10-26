import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { StorageProvider, StorageUploadResult, StorageDownloadResult } from "./index.ts";

/**
 * Local filesystem storage provider for development and testing.
 * Stores files securely inside `data/resumes/<candidateId>/`.
 */
export class LocalStorageProvider implements StorageProvider {
  name = "local" as const;
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.resolve(process.cwd(), "data", "resumes");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveSafeKeyPath(key: string): string {
    const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.resolve(this.baseDir, normalizedKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error("Path traversal violation in local storage key resolution.");
    }
    return fullPath;
  }

  async upload(
    candidateId: string,
    originalFilename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const safeCandidateId = candidateId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const candidateDir = path.join(this.baseDir, safeCandidateId);
    if (!fs.existsSync(candidateDir)) {
      fs.mkdirSync(candidateDir, { recursive: true });
    }

    const safeBase = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const randomPrefix = randomUUID();
    const storageKey = `${safeCandidateId}/${randomPrefix}_${safeBase}`;
    const destination = path.join(this.baseDir, storageKey);

    fs.writeFileSync(destination, buffer);

    return {
      key: storageKey,
      provider: "local",
      byteSize: buffer.length,
      mimeType,
      storagePath: destination,
    };
  }

  async download(key: string): Promise<StorageDownloadResult> {
    const fullPath = this.resolveSafeKeyPath(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found in local storage: ${key}`);
    }

    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    return {
      buffer,
      contentType,
      contentLength: buffer.length,
    };
  }

  async getSignedDownloadUrl(): Promise<string | null> {
    // Local storage does not use remote presigned URLs; returns null to trigger proxy streaming
    return null;
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveSafeKeyPath(key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullPath = this.resolveSafeKeyPath(key);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }
}
