import { NextRequest, NextResponse } from "next/server";
import { getResumeRepository, getCandidateRepository } from "@/lib/repository";
import { getStorageProvider } from "@/lib/storage";
import { checkAdminAuth } from "@/lib/auth/admin";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import path from "node:path";
import fs from "node:fs";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const resumeRepo = getResumeRepository();
    const resume = await resumeRepo.getById(id);

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    // Resolve authenticated candidate and admin privileges on server
    const auth = getAuthenticatedCandidate(request);
    const adminCheck = checkAdminAuth(request);

    if ((!auth || !auth.authenticated) && !adminCheck.authorized) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required to download resume." },
        { status: 401 }
      );
    }

    // Prevent Horizontal Privilege Escalation: Candidate A cannot access Candidate B's resume
    const isOwner = auth && auth.candidateId === resume.candidateId;
    const isAdmin = adminCheck.authorized;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to access another candidate's resume." },
        { status: 403 }
      );
    }

    const storage = getStorageProvider();

    // 1. If stored in durable storage with a storageKey
    if (resume.storageKey) {
      try {
        const downloadResult = await storage.download(resume.storageKey);
        return new NextResponse(new Uint8Array(downloadResult.buffer), {
          headers: {
            "Content-Type": downloadResult.contentType,
            "Content-Disposition": `attachment; filename="${path.basename(resume.fileName)}"`,
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (storageErr) {
        console.warn(`[Resume Download] Storage key lookup failed (${resume.storageKey}), falling back to disk/synthetic:`, storageErr);
      }
    }

    // 2. Local disk file check
    if (resume.filePath && fs.existsSync(resume.filePath)) {
      const storageDir = path.resolve(process.cwd(), "data", "resumes");
      const targetPath = path.resolve(resume.filePath);

      // Strict path traversal prevention: ensure targetPath is strictly inside data/resumes
      if (!targetPath.startsWith(storageDir)) {
        return NextResponse.json({ error: "Invalid file location" }, { status: 400 });
      }

      const fileBuffer = fs.readFileSync(targetPath);
      const ext = path.extname(resume.fileName).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${path.basename(resume.fileName)}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // 3. Synthetic PDF buffer fallback (e.g. for seed data without local files)
    const candRepo = getCandidateRepository();
    const candidate = (await candRepo.getById(resume.candidateId)) || { name: "Candidate" };
    const syntheticPdf = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<< /Title (${resume.fileName}) /Author (${candidate.name}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
    );
    return new NextResponse(new Uint8Array(syntheticPdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${path.basename(resume.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
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
