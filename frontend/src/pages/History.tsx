import { useQuery } from '@tanstack/react-query'
import { GitCommit, Clock, User } from 'lucide-react'
import { fetchHistory } from '../api/history'
import { usePageTitle } from '../hooks/usePageTitle'

export default function History() {
  usePageTitle('History')
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
          {entries?.map((entry, i) => (
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
              </div>
            </div>
          ))}
        </div>

        {entries?.length === 0 && <p className="text-subtext0 text-center py-8">No history yet.</p>}
      </div>
    </div>
  )
}
