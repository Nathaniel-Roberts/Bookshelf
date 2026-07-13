import api from './client'

export interface HistoryEntry {
  commit_hash: string
  committer: string
  message: string
  date: string
}

// One row from a dolt_diff_* table: to_*/from_* column pairs plus diff_type
export type DiffRow = Record<string, unknown> & {
  diff_type: 'added' | 'removed' | 'modified'
}

export const fetchHistory = (limit: number = 50) =>
  api.get<HistoryEntry[]>('/history', { params: { limit } }).then((r) => r.data)

export const revertCommit = (commitHash: string) =>
  api.post(`/history/revert/${commitHash}`).then((r) => r.data)

export const fetchDiffAll = (fromCommit: string, toCommit: string) =>
  api
    .get<Record<string, DiffRow[]>>('/history/diff-all', {
      params: { from_commit: fromCommit, to_commit: toCommit },
    })
    .then((r) => r.data)
