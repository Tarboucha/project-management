export interface LookupItem {
  id: string
  name: string
  code?: string | null
  description?: string | null
  isActive: boolean
  _count: { projects: number }
}
