/** Format an ISO date string for display (e.g. "3/1/2026") */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

/** Format an ISO date string for date input fields (YYYY-MM-DD) */
export function formatDateForInput(dateStr?: string | null): string {
  if (!dateStr) return ""
  return dateStr.slice(0, 10)
}
