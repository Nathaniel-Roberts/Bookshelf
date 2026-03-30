import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Library, Pencil, Trash2, Save, X, BookOpen } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchSeries, updateSeries, deleteSeries } from '../api/series'
import { fetchBooks, type Book } from '../api/books'

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { data: series, isLoading } = useQuery({
    queryKey: ['series', id],
    queryFn: () => fetchSeries(id!),
    enabled: !!id,
  })

  const { data: books } = useQuery({
    queryKey: ['books', { series_id: id }],
    queryFn: () => fetchBooks({ series_id: id! }),
    enabled: !!id,
  })

  const sortedBooks = (books ?? []).slice().sort((a: Book, b: Book) => {
    const pa = parseFloat(a.series_position ?? '0')
    const pb = parseFloat(b.series_position ?? '0')
    return pa - pb
  })

  const editMutation = useMutation({
    mutationFn: () => updateSeries(id!, { name, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', id] })
      setEditing(false)
      toast.success('Series updated!')
    },
    onError: () => toast.error('Failed to update series.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSeries(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
      toast.success('Series deleted!')
      navigate('/series')
    },
    onError: () => toast.error('Failed to delete series.'),
  })

  function startEdit() {
    if (!series) return
    setName(series.name)
    setDescription(series.description ?? '')
    setEditing(true)
  }

  if (isLoading) return <p className="text-subtext0 text-center py-8">Loading...</p>
  if (!series) return <p className="text-red text-center py-8">Series not found.</p>

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {!editing ? (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              <Library size={24} className="text-mauve" /> {series.name}
            </h1>
            {series.description && <p className="text-subtext0 mt-1">{series.description}</p>}
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={startEdit} className="p-2 bg-surface0 hover:bg-surface1 text-text rounded-lg">
                <Pencil size={16} />
              </button>
              <button
                onClick={() => window.confirm('Delete this series?') && deleteMutation.mutate()}
                className="p-2 bg-surface0 hover:bg-red/20 text-red rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface0 rounded-lg p-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
          />
          <div className="flex gap-2">
            <button onClick={() => editMutation.mutate()} className="px-3 py-2 bg-green text-base rounded-lg font-medium flex items-center gap-1">
              <Save size={14} /> Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-2 bg-surface1 text-text rounded-lg flex items-center gap-1">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-text">Books in Series</h2>
      <div className="space-y-2">
        {sortedBooks.map((book) => (
          <Link
            key={book.id}
            to={`/books/${book.id}`}
            className="flex items-center gap-3 bg-surface0 hover:bg-surface1 rounded-lg p-3 transition-colors"
          >
            {book.cover_url ? (
              <img src={book.cover_url} alt="" className="w-10 h-14 object-cover rounded" />
            ) : (
              <div className="w-10 h-14 bg-mantle rounded flex items-center justify-center">
                <BookOpen size={16} className="text-overlay0" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-text font-medium truncate">
                {book.series_position && <span className="text-mauve mr-1">#{book.series_position}</span>}
                {book.title}
              </p>
              <p className="text-subtext0 text-sm truncate">{(book.authors ?? []).join(', ')}</p>
            </div>
          </Link>
        ))}
        {sortedBooks.length === 0 && <p className="text-subtext0 text-center py-4">No books in this series yet.</p>}
      </div>
    </div>
  )
}
