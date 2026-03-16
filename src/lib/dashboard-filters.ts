export type DashboardFilters = {
 startDate: string
 endDate: string
 repId?: string
 teamId?: string
}

export function getCurrentMonthRange() {
 const now = new Date()

 const start = new Date(now.getFullYear(), now.getMonth(), 1)
 const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

 return {
  startDate: start.toISOString().slice(0, 10),
  endDate: end.toISOString().slice(0, 10),
 }
}