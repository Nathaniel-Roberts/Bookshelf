import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCommit, Clock, User, ChevronDown, ChevronRight } from 'lucide-react'
import { fetchHistory, fetchDiffAll, type DiffRow } from '../api/history'
import { usePageTitle } from '../hooks/usePageTitle'

// Columns in dolt_diff_* rows that aren't table data
const META_COLUMNS = new Set([
  'diff_type',
  'from_commit',
  'to_commit',
  'from_commit_date',
  'to_commit_date',
])

function dataFields(row: DiffRow): string[] {
  const fields = new Set<string>()
  for (const key of Object.keys(row)) {
    if (META_COLUMNS.has(key)) continue
    if (key.startsWith('to_')) fields.add(key.slice(3))
    else if (key.startsWith('from_')) fields.add(key.slice(5))
  }
  return [...fields]
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function rowLabel(row: DiffRow): string {
  for (const field of ['title', 'name', 'barcode', 'borrower_name', 'key']) {
    const v = row[`to_${field}`] ?? row[`from_${field}`]
    if (v) return String(v)
  }
  return String(row.to_id ?? row.from_id ?? '')
}

function DiffRowView({ row }: { row: DiffRow }) {
  const typeStyle = {
    added: 'text-green bg-green/15',
    removed: 'text-red bg-red/15',
    modified: 'text-yellow bg-yellow/15',
  }[row.diff_type]

  const changes = dataFields(row)
    .map((field) => ({ field, from: row[`from_${field}`], to: row[`to_${field}`] }))
    .filter(({ field, from, to }) => {
      if (field === 'updated_at' || field === 'created_at') return false
      return JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)
    })

  return (
    <div className="rounded bg-mantle p-2 text-xs space-y-1">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${typeStyle}`}>
          {row.diff_type}
        </span>
        <span className="text-text font-medium truncate">{rowLabel(row)}</span>
      </div>
      {row.diff_type === 'modified' && (
        <ul className="space-y-0.5 pl-1">
          {changes.map(({ field, from, to }) => (
            <li key={field} className="text-subtext0">
              <span className="text-subtext1">{field}:</span>{' '}
              <span className="text-red/80 line-through">{formatValue(from)}</span>{' '}
              <span className="text-green">{formatValue(to)}</span>
            </li>
          ))}
        </ul>
      )}
      {row.diff_type === 'added' && (
        <ul className="space-y-0.5 pl-1">
          {changes
            .filter(({ to }) => to !== null && to !== undefined && to !== '')
            .map(({ field, to }) => (
              <li key={field} className="text-subtext0">
                <span className="text-subtext1">{field}:</span> {formatValue(to)}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function DiffView({ fromCommit, toCommit }: { fromCommit: string; toCommit: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['diff', fromCommit, toCommit],
    queryFn: () => fetchDiffAll(fromCommit, toCommit),
    staleTime: Infinity, // commits are immutable
  })

  if (isLoading) return <p className="text-subtext0 text-xs pt-2">Loading diff...</p>
  if (isError) return <p className="text-red text-xs pt-2">Failed to load diff.</p>

  const tables = Object.entries(data ?? {})
  if (tables.length === 0) {
    return <p className="text-subtext0 text-xs pt-2">No table changes in this commit.</p>
  }

  return (
    <div className="space-y-2 pt-2">
      {tables.map(([table, rows]) => (
        <div key={table} className="space-y-1">
          <p className="text-xs font-semibold text-subtext1 uppercase tracking-wide">{table}</p>
          {rows.map((row, i) => (
            <DiffRowView key={i} row={row} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function History() {
  usePageTitle('History')
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data: entries, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: () => fetchHistory(50),
  })

  function formatDate(d: string) {
    return new Date(d).toLocaleString()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <GitCommit size={24} className="text-mauve" /> History
      </h1>

      {isLoading && <p className="text-subtext0">Loading...</p>}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface1" />

        <div className="space-y-0">
          {entries?.map((entry, i) => {
            const parent = entries[i + 1]
            const isExpanded = expanded === entry.commit_hash
            return (
              <div key={entry.commit_hash + i} className="relative pl-10 pb-6">
                {/* Dot */}
                <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-mauve ring-4 ring-base" />

                <div className="bg-surface0 rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm bg-mantle px-2 py-0.5 rounded text-blue font-mono">
                      {entry.commit_hash.slice(0, 8)}
                    </code>
                    <span className="text-xs text-subtext1 flex items-center gap-1">
                      <Clock size={12} /> {formatDate(entry.date)}
                    </span>
                  </div>
                  <p className="text-text">{entry.message}</p>
                  <p className="text-subtext0 text-sm flex items-center gap-1">
                    <User size={12} /> {entry.committer}
                  </p>

                  {parent && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : entry.commit_hash)}
                      className="flex items-center gap-1 text-xs text-subtext1 hover:text-text pt-1"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {isExpanded ? 'Hide changes' : 'Show changes'}
                    </button>
                  )}
                  {isExpanded && parent && (
                    <DiffView fromCommit={parent.commit_hash} toCommit={entry.commit_hash} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {entries?.length === 0 && <p className="text-subtext0 text-center py-8">No history yet.</p>}
      </div>
    </div>
  )
}
