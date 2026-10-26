import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageUploadResult {
  key: string;
  provider: "s3" | "local";
  byteSize: number;
  mimeType: string;
  storagePath?: string;
}

export interface StorageDownloadResult {
  buffer: Buffer;
  contentType: string;
  contentLength: number;
}

export interface StorageProvider {
  name: "s3" | "local";
  upload(
    candidateId: string,
    originalFilename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult>;
  download(key: string): Promise<StorageDownloadResult>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

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

/**
 * AWS S3 and S3-compatible (Cloudflare R2, MinIO, Supabase) Private Object Storage.
 * Uses private bucket access with short-lived presigned URLs or authenticated proxying.
 */
export class S3StorageProvider implements StorageProvider {
  name = "s3" as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    const bucket = process.env.STORAGE_BUCKET || process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error("STORAGE_BUCKET or S3_BUCKET environment variable is required for S3 storage.");
    }
    this.bucket = bucket;

    const region = process.env.STORAGE_REGION || process.env.AWS_REGION || "us-east-1";
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const forcePathStyle = process.env.STORAGE_FORCE_PATH_STYLE === "true";

    const clientConfig: {
      region: string;
      endpoint?: string;
      forcePathStyle?: boolean;
      credentials?: { accessKeyId: string; secretAccessKey: string };
    } = {
      region,
      forcePathStyle,
    };

    if (endpoint) {
      clientConfig.endpoint = endpoint;
    }

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = { accessKeyId, secretAccessKey };
    }

    this.client = new S3Client(clientConfig);
  }

  async upload(
    candidateId: string,
    originalFilename: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StorageUploadResult> {
    const safeCandidateId = candidateId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeBase = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const randomPrefix = randomUUID();
    const storageKey = `resumes/${safeCandidateId}/${randomPrefix}_${safeBase}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          candidateId: safeCandidateId,
          originalFilename: safeBase,
        },
      })
    );

    return {
      key: storageKey,
      provider: "s3",
      byteSize: buffer.length,
      mimeType,
    };
  }

  async download(key: string): Promise<StorageDownloadResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`S3 Object body empty for key: ${key}`);
    }

    const byteArray = await response.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);
    const contentType = response.ContentType || "application/pdf";

    return {
      buffer,
      contentType,
      contentLength: buffer.length,
    };
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }
}

let activeStorageProvider: StorageProvider | null = null;

/**
 * Returns the configured storage provider (S3 or local fallback).
 * Fails safely if cloud credentials are misconfigured in production.
 */
export function getStorageProvider(): StorageProvider {
  if (activeStorageProvider) {
    return activeStorageProvider;
  }

  const requestedProvider = (process.env.STORAGE_PROVIDER || "").toLowerCase().trim();
  const hasS3Bucket = Boolean(process.env.STORAGE_BUCKET || process.env.S3_BUCKET);
  const isProduction = process.env.NODE_ENV === "production";

  if (requestedProvider === "s3" || (requestedProvider === "" && hasS3Bucket)) {
    try {
      activeStorageProvider = new S3StorageProvider();
      return activeStorageProvider;
    } catch (err) {
      if (isProduction) {
        throw new Error(
          `Production S3 storage provider failed to initialize: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.warn("[Storage] S3 initialization failed, falling back to LocalStorageProvider for dev:", err);
    }
  }

  activeStorageProvider = new LocalStorageProvider();
  return activeStorageProvider;
}

/**
 * Reset active storage provider instance (used during testing)
 */
export function setStorageProvider(provider: StorageProvider | null): void {
  activeStorageProvider = provider;
}
