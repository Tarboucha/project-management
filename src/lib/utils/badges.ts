/** Map task priority to Badge variant */
export function priorityVariant(priority: string) {
  switch (priority) {
    case "URGENT": return "destructive" as const
    case "HIGH": return "destructive" as const
    case "MEDIUM": return "secondary" as const
    default: return "outline" as const
  }
}
