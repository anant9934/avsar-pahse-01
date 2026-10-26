export function formatDeadline(rawDeadline?: string | null): string {
  if (!rawDeadline) return "Rolling / Open";
  try {
    const date = new Date(rawDeadline);
    if (!isNaN(date.getTime())) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }
  } catch {
    // fallback
  }
  return rawDeadline;
}

export function isDeadlineExpired(deadlineStr?: string | null): boolean {
  if (!deadlineStr) return false;
  const parsed = new Date(deadlineStr).getTime();
  if (isNaN(parsed)) return false;
  return parsed < Date.now();
}
