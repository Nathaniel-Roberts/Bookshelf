import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Library, Plus, X, BookOpen } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchAllSeries, createSeries } from '../api/series'
import { usePageTitle } from '../hooks/usePageTitle'

export default function SeriesList() {
  usePageTitle('Series')
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { data: series, isLoading } = useQuery({ queryKey: ['series'], queryFn: fetchAllSeries })

  const createMutation = useMutation({
    mutationFn: () => createSeries({ name, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
      setShowForm(false)
      setName('')
      setDescription('')
      toast.success('Series created!')
    },
    onError: () => toast.error('Failed to create series.'),
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <Library size={24} className="text-mauve" /> Series
        </h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-2 bg-mauve text-base rounded-lg font-medium flex items-center gap-1"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'New Series'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-surface0 rounded-lg p-4 space-y-3">
          <input
            placeholder="Series name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
          />
          <button
            onClick={() => name && createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            className="px-4 py-2 bg-green text-base rounded-lg font-medium disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      {isLoading && <p className="text-subtext0">Loading...</p>}

      <div className="space-y-2">
        {series?.map((s) => (
          <Link
            key={s.id}
            to={`/series/${s.id}`}
            className="flex items-center justify-between bg-surface0 hover:bg-surface1 rounded-lg p-4 transition-colors"
          >
            <div>
              <p className="text-text font-medium">{s.name}</p>
              {s.description && <p className="text-subtext0 text-sm mt-0.5">{s.description}</p>}
            </div>
            <span className="flex items-center gap-1 text-subtext1 text-sm">
              <BookOpen size={14} /> {s.book_count} {s.book_count === 1 ? 'book' : 'books'}
            </span>
          </Link>
        ))}
        {series?.length === 0 && <p className="text-subtext0 text-center py-8">No series yet.</p>}
      </div>
    </div>
  )
}
