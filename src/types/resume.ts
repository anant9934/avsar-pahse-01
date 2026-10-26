export interface Resume {
  id: string;
  candidateId: string;
  fileName: string;
  fileSize: string; // e.g. "2.4 MB"
  uploadedAt: string; // relative or formatted date
  isPrimary: boolean;
  filePath?: string;
  storageKey?: string;
  storageProvider?: "local" | "s3" | string;
}
