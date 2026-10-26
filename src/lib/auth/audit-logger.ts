export interface AdminAuditEntry {
  timestamp: string;
  action: string;
  ip?: string;
  success: boolean;
  details?: string;
}

const auditLogs: AdminAuditEntry[] = [];

export function logAdminAction(entry: Omit<AdminAuditEntry, "timestamp">): void {
  auditLogs.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (auditLogs.length > 500) {
    auditLogs.pop();
  }
}

export function getAdminAuditLogs(): AdminAuditEntry[] {
  return [...auditLogs];
}

export function clearAdminAuditLogs(): void {
  auditLogs.length = 0;
}
