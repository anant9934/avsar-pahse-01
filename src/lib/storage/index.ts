import { validateDocumentMagicBytes } from "./magic-bytes.ts";
import { LocalStorageProvider } from "./local-provider.ts";
import { S3StorageProvider } from "./s3-provider.ts";

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

export { validateDocumentMagicBytes, LocalStorageProvider, S3StorageProvider };

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

  const allowEphemeral = process.env.ALLOW_EPHEMERAL_LOCAL_STORAGE === "true";

  if (requestedProvider === "s3" || (requestedProvider === "" && hasS3Bucket)) {
    try {
      activeStorageProvider = new S3StorageProvider();
      return activeStorageProvider;
    } catch (err) {
      if (isProduction && !allowEphemeral) {
        throw new Error(
          `Production S3 storage provider failed to initialize: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.warn("[Storage] S3 initialization failed, falling back to LocalStorageProvider for dev:", err);
    }
  }

  if (isProduction && !allowEphemeral) {
    throw new Error(
      "Production deployment requires durable cloud object storage (STORAGE_BUCKET or S3_BUCKET). Local ephemeral filesystem storage is prohibited to prevent document loss. Set ALLOW_EPHEMERAL_LOCAL_STORAGE=true to explicitly override in non-production environments."
    );
  }

  activeStorageProvider = new LocalStorageProvider();
  return activeStorageProvider;
}

/**
 * Check whether ephemeral local file storage is explicitly allowed in current environment
 */
export function isEphemeralStorageAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_EPHEMERAL_LOCAL_STORAGE === "true";
}

/**
 * Reset active storage provider instance (used during testing)
 */
export function setStorageProvider(provider: StorageProvider | null): void {
  activeStorageProvider = provider;
}
