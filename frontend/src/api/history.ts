import api from './client'

export interface HistoryEntry {
  commit_hash: string
  committer: string
  message: string
  date: string
}

export const fetchHistory = (limit: number = 50) =>
  api.get<HistoryEntry[]>('/history', { params: { limit } }).then((r) => r.data)

export const fetchDiff = (table: string, fromCommit: string, toCommit: string) =>
  api
    .get(`/history/diff/${table}`, { params: { from_commit: fromCommit, to_commit: toCommit } })
    .then((r) => r.data)
