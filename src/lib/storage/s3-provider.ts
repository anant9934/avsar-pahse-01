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
import type { StorageProvider, StorageUploadResult, StorageDownloadResult } from "./index.ts";

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
