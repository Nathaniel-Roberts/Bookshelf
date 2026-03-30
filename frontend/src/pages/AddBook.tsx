import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { BookPlus, Search, Camera, Keyboard, Plus, X, ArrowRightLeft, Save, ShieldAlert, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useScanner } from '../hooks/useScanner'
import { lookupIsbn, createBook, type BookCreate } from '../api/books'
import { fetchAllSeries, createSeries } from '../api/series'
import { createCopy } from '../api/copies'

type Tab = 'scan' | 'manual'

export default function AddBook() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const [tab, setTab] = useState<Tab>('scan')
  const [isbn, setIsbn] = useState(searchParams.get('isbn') ?? '')
  const [source, setSource] = useState<string | undefined>()
  const [form, setForm] = useState<BookCreate | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [newSeriesName, setNewSeriesName] = useState('')
  const [showNewSeries, setShowNewSeries] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  const { data: seriesList } = useQuery({ queryKey: ['series'], queryFn: fetchAllSeries })

  // Use a ref-based lookup so the scanner callback is never stale
  // Accepts optional sourceOverride to avoid stale state when switching sources
  const doLookup = useRef<(val: string, sourceOverride?: string) => Promise<void>>(undefined)

  doLookup.current = async (value: string, sourceOverride?: string) => {
    const cleaned = value.trim().replace(/[-\s]/g, '')
    if (!cleaned) return
    setIsbn(cleaned)
    setLookingUp(true)
    try {
      const data = await lookupIsbn(cleaned, sourceOverride ?? source)
      if (data.error) {
        toast.error(data.error)
        return
      }
      setForm({
        isbn13: data.isbn13 ?? '',
        isbn10: data.isbn10 ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        authors: data.authors ?? [],
        publisher: data.publisher ?? '',
        publish_date: data.publish_date ?? '',
        description: data.description ?? '',
        page_count: data.page_count ?? undefined,
        cover_url: data.cover_url ?? '',
        genres: data.genres ?? [],
        language: data.language ?? '',
        tags: [],
        metadata_source: data.metadata_source ?? source ?? '',
      })
      toast.success(`Metadata found: ${data.title}`)
    } catch {
      toast.error('ISBN lookup failed.')
    } finally {
      setLookingUp(false)
    }
  }

  // Auto-lookup if ISBN is passed via query param
  useEffect(() => {
    const initialIsbn = searchParams.get('isbn')
    if (initialIsbn) {
      doLookup.current?.(initialIsbn)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onScan = useCallback((code: string) => {
    doLookup.current?.(code)
  }, [])

  const { elementId, isScanning, error: scanError, start, stop } = useScanner({ onScan })

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-subtext0">
        <ShieldAlert size={48} className="text-red" />
        <p className="text-lg">Admin access required to add books.</p>
      </div>
    )
  }

  function tryOtherSource() {
    const currentSource = form?.metadata_source
    const next = currentSource === 'googlebooks' ? 'openlibrary' : 'googlebooks'
    setSource(next)
    doLookup.current?.(isbn, next)
  }

  function updateField<K extends keyof BookCreate>(key: K, value: BookCreate[K]) {
    if (!form) return
    setForm({ ...form, [key]: value })
  }

  function addTag() {
    if (!form || !tagInput.trim()) return
    setForm({ ...form, tags: [...(form.tags ?? []), tagInput.trim()] })
    setTagInput('')
  }

  function removeTag(idx: number) {
    if (!form) return
    setForm({ ...form, tags: (form.tags ?? []).filter((_, i) => i !== idx) })
  }

  const saveMutation = useMutation({
    mutationFn: createBook,
    onSuccess: async (book) => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      toast.success('Book saved!')
      const addCopy = window.confirm('Add first copy?')
      if (addCopy) {
        try {
          await createCopy(book.id, {})
          toast.success('Copy created!')
        } catch {
          toast.error('Failed to create copy.')
        }
      }
      navigate(`/books/${book.id}`)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to save book.'
      toast.error(msg)
    },
  })

  const createSeriesMutation = useMutation({
    mutationFn: (name: string) => createSeries({ name }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
      if (form) setForm({ ...form, series_id: s.id })
      setShowNewSeries(false)
      setNewSeriesName('')
      toast.success('Series created!')
    },
  })

  const tabCls = (t: Tab) =>
    `flex-1 py-2.5 text-center font-medium rounded-lg transition-colors ${
      tab === t ? 'bg-mauve text-base' : 'text-subtext0 hover:text-text'
    }`

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <BookPlus size={24} className="text-mauve" /> Add Book
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 bg-surface0 rounded-lg p-1">
        <button className={tabCls('scan')} onClick={() => setTab('scan')}>
          <Camera size={16} className="inline mr-1" /> Scan ISBN
        </button>
        <button className={tabCls('manual')} onClick={() => setTab('manual')}>
          <Keyboard size={16} className="inline mr-1" /> Manual Entry
        </button>
      </div>

      {/* Scan tab */}
      {tab === 'scan' && (
        <div className="space-y-4">
          <div
            id={elementId}
            className="w-full aspect-video bg-mantle rounded-lg overflow-hidden border border-surface1"
          />
          <div className="flex gap-2">
            {!isScanning ? (
              <button onClick={start} className="px-4 py-2 bg-blue text-base rounded-lg font-medium">
                Start Camera
              </button>
            ) : (
              <button onClick={stop} className="px-4 py-2 bg-red text-base rounded-lg font-medium">
                Stop Camera
              </button>
            )}
          </div>
          {scanError && <p className="text-red text-sm">{scanError}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter ISBN manually"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doLookup.current?.(isbn)}
              className="flex-1 bg-surface0 border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
            />
            <button
              onClick={() => doLookup.current?.(isbn)}
              disabled={lookingUp}
              className="px-4 py-2 bg-mauve text-base rounded-lg font-medium disabled:opacity-50 flex items-center gap-1"
            >
              {lookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Lookup
            </button>
          </div>
          {lookingUp && (
            <div className="flex items-center gap-2 text-subtext0 text-sm">
              <Loader2 size={14} className="animate-spin" /> Looking up ISBN...
            </div>
          )}
        </div>
      )}

      {/* Form — shown after lookup or in manual tab */}
      {(tab === 'manual' || form) && (
        <div className="space-y-4 bg-surface0 rounded-lg p-4">
          {form?.metadata_source && (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue/20 text-blue px-2 py-0.5 rounded-full">
                Source: {form.metadata_source}
              </span>
              <button onClick={tryOtherSource} className="text-xs text-subtext0 hover:text-text flex items-center gap-1">
                <ArrowRightLeft size={12} /> Try other source
              </button>
            </div>
          )}

          {/* Cover preview */}
          {form && (
            <div className="flex flex-col items-center gap-2">
              {form.cover_url ? (
                <img
                  src={form.cover_url}
                  alt="Cover preview"
                  className="h-48 rounded-lg shadow-lg object-contain"
                />
              ) : (
                <div className="h-48 w-32 rounded-lg bg-mantle border border-surface1 flex items-center justify-center text-overlay0 text-sm text-center px-2">
                  No cover found
                </div>
              )}
              <label className="w-full max-w-md">
                <span className="text-subtext1 text-xs">Cover URL (paste or edit)</span>
                <input
                  value={form.cover_url ?? ''}
                  onChange={(e) => updateField('cover_url', e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mauve"
                />
              </label>
            </div>
          )}

          {/* Title */}
          <label className="block">
            <span className="text-subtext1 text-sm">Title *</span>
            <input
              value={form?.title ?? ''}
              onChange={(e) => updateField('title', e.target.value)}
              className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
            />
          </label>

          <label className="block">
            <span className="text-subtext1 text-sm">Subtitle</span>
            <input
              value={form?.subtitle ?? ''}
              onChange={(e) => updateField('subtitle', e.target.value)}
              className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
            />
          </label>

          <label className="block">
            <span className="text-subtext1 text-sm">Authors (comma-separated)</span>
            <input
              value={(form?.authors ?? []).join(', ')}
              onChange={(e) => updateField('authors', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-subtext1 text-sm">ISBN-13</span>
              <input
                value={form?.isbn13 ?? ''}
                onChange={(e) => updateField('isbn13', e.target.value)}
                className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            </label>
            <label className="block">
              <span className="text-subtext1 text-sm">ISBN-10</span>
              <input
                value={form?.isbn10 ?? ''}
                onChange={(e) => updateField('isbn10', e.target.value)}
                className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-subtext1 text-sm">Publisher</span>
              <input
                value={form?.publisher ?? ''}
                onChange={(e) => updateField('publisher', e.target.value)}
                className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            </label>
            <label className="block">
              <span className="text-subtext1 text-sm">Publish Date</span>
              <input
                value={form?.publish_date ?? ''}
                onChange={(e) => updateField('publish_date', e.target.value)}
                className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-subtext1 text-sm">Description</span>
            <textarea
              rows={3}
              value={form?.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-subtext1 text-sm">Page Count</span>
              <input
                type="number"
                value={form?.page_count ?? ''}
                onChange={(e) => updateField('page_count', e.target.value ? Number(e.target.value) : undefined)}
                className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            </label>
            <label className="block">
              <span className="text-subtext1 text-sm">Language</span>
              <input
                value={form?.language ?? ''}
                onChange={(e) => updateField('language', e.target.value)}
                className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-subtext1 text-sm">Genres (comma-separated)</span>
            <input
              value={(form?.genres ?? []).join(', ')}
              onChange={(e) => updateField('genres', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
            />
          </label>

          {/* Series */}
          <div>
            <span className="text-subtext1 text-sm block mb-1">Series</span>
            <div className="flex gap-2">
              <select
                value={form?.series_id ?? ''}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowNewSeries(true)
                  } else {
                    updateField('series_id', e.target.value || undefined)
                  }
                }}
                className="flex-1 bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              >
                <option value="">None</option>
                {seriesList?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="__new__">+ Create new</option>
              </select>
              {form?.series_id && (
                <input
                  placeholder="Position"
                  value={form?.series_position ?? ''}
                  onChange={(e) => updateField('series_position', e.target.value)}
                  className="w-24 bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
                />
              )}
            </div>
            {showNewSeries && (
              <div className="flex gap-2 mt-2">
                <input
                  placeholder="Series name"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  className="flex-1 bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
                />
                <button
                  onClick={() => newSeriesName && createSeriesMutation.mutate(newSeriesName)}
                  className="px-3 py-2 bg-green text-base rounded-lg font-medium"
                >
                  <Plus size={16} />
                </button>
                <button onClick={() => setShowNewSeries(false)} className="px-3 py-2 bg-surface1 text-text rounded-lg">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <span className="text-subtext1 text-sm block mb-1">Tags</span>
            <div className="flex flex-wrap gap-1 mb-2">
              {(form?.tags ?? []).map((t, i) => (
                <span key={i} className="bg-mauve/20 text-mauve px-2 py-0.5 rounded-full text-sm flex items-center gap-1">
                  {t}
                  <button onClick={() => removeTag(i)}><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                placeholder="Add tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
              <button onClick={addTag} className="px-3 py-2 bg-surface1 text-text rounded-lg">
                <Plus size={16} />
              </button>
            </div>
          </div>

          <button
            onClick={() => form && saveMutation.mutate(form)}
            disabled={!form?.title || saveMutation.isPending}
            className="w-full py-3 bg-green text-base rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={18} /> Save Book
          </button>
        </div>
      )}
    </div>
  )
}
