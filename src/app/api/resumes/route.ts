import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const resumes = db.getResumes();
  return NextResponse.json({ resumes });
}

export async function POST(request: NextRequest) {
  try {
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

      // Store file in server private storage
      const storageDir = path.join(process.cwd(), "data", "resumes");
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const targetPath = path.join(storageDir, safeFileName);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);

      const candidate = db.getCandidate();
      const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";

      const newResume = db.addResume({
        candidateId: candidate.id,
        fileName: file.name,
        fileSize: sizeStr,
        isPrimary: true,
        filePath: targetPath,
      });

      return NextResponse.json({ success: true, resume: newResume });
    }

    // JSON fallback
    const body = await request.json();
    const candidate = db.getCandidate();
    const newResume = db.addResume({
      candidateId: candidate.id,
      fileName: body.fileName || "Candidate_Resume.pdf",
      fileSize: body.fileSize || "1.2 MB",
      isPrimary: body.isPrimary ?? false,
    });

    return NextResponse.json({ success: true, resume: newResume });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
