import type { ReportData } from '@/app/page'

export interface SavedReport {
  id: string
  createdAt: string
  updatedAt: string
  data: ReportData
  recipientEmails: string[]
}

const KEY = 'ynpj_reports'
const MAX = 30

export function getReports(): SavedReport[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedReport[]
  } catch {
    return []
  }
}

function persist(reports: SavedReport[]): void {
  localStorage.setItem(KEY, JSON.stringify(reports.slice(0, MAX)))
}

export function saveReport(data: ReportData, recipientEmails: string[]): SavedReport {
  const report: SavedReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data,
    recipientEmails,
  }
  persist([report, ...getReports()])
  return report
}

export function updateReport(id: string, data: ReportData, recipientEmails: string[]): void {
  const reports = getReports()
  const idx = reports.findIndex(r => r.id === id)
  if (idx === -1) return
  reports[idx] = { ...reports[idx], updatedAt: new Date().toISOString(), data, recipientEmails }
  persist(reports)
}

export function deleteReport(id: string): void {
  persist(getReports().filter(r => r.id !== id))
}
