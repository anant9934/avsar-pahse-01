import { NextRequest, NextResponse } from "next/server";
import { getResumeRepository } from "@/lib/repository";
import { getStorageProvider, validateDocumentMagicBytes } from "@/lib/storage";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import path from "node:path";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to view resumes." },
        { status: 401 }
      );
    }

    const resumeRepo = getResumeRepository();
    const resumes = await resumeRepo.listByCandidate(auth.candidateId);
    return NextResponse.json({ resumes });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || err instanceof DatabaseConfigurationError) {
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to upload resumes." },
        { status: 401 }
      );
    }

    // Enforce storage quota protection: max 5 resumes per candidate
    const resumeRepo = getResumeRepository();
    const existingResumes = await resumeRepo.listByCandidate(auth.candidateId);
    if (existingResumes.length >= 5) {
      return NextResponse.json(
        {
          error:
            "Maximum resume upload limit reached (5 documents). Please delete an older resume before uploading a new one.",
        },
        { status: 400 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
      }

      // 5 MB size limit
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: "File exceeds maximum permitted size of 5 MB" },
          { status: 400 }
        );
      }

      // Extension validation
      const validExtensions = [".pdf", ".doc", ".docx"];
      const ext = path.extname(file.name).toLowerCase();
      if (!validExtensions.includes(ext)) {
        return NextResponse.json(
          { error: "Only PDF, DOC, and DOCX formats are allowed" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Magic bytes verification (prevent renamed executable payloads)
      const isValidDocument = validateDocumentMagicBytes(buffer, ext);
      if (!isValidDocument) {
        return NextResponse.json(
          {
            error:
              "Corrupted or invalid document format: file contents do not match the expected document type signature.",
          },
          { status: 400 }
        );
      }

      // Upload file to private durable object storage
      const storage = getStorageProvider();
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
      };
      const resolvedMime = mimeMap[ext] || "application/octet-stream";

      const uploadResult = await storage.upload(auth.candidateId, file.name, buffer, resolvedMime);
      const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";

      // Persist resume metadata in repository
      const newResume = await resumeRepo.create(
        {
          candidateId: auth.candidateId,
          fileName: file.name,
          fileSize: sizeStr,
          isPrimary: true,
          filePath: uploadResult.storagePath || undefined,
          storageProvider: uploadResult.provider,
          storageKey: uploadResult.key,
        },
        auth.candidateId
      );

      return NextResponse.json({ success: true, resume: newResume });
    }

    // JSON fallback
    const body = await request.json();
    const newResume = await resumeRepo.create(
      {
        candidateId: auth.candidateId,
        fileName: body.fileName || "Candidate_Resume.pdf",
        fileSize: body.fileSize || "1.2 MB",
        isPrimary: body.isPrimary ?? false,
      },
      auth.candidateId
    );

    return NextResponse.json({ success: true, resume: newResume });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || err instanceof DatabaseConfigurationError) {
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
