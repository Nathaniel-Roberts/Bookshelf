import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Heart,
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  BookOpen,
  MapPin,
  Undo2,
} from 'lucide-react'
import { fetchBook, updateBook, deleteBook, type Book, type BookCreate } from '../api/books'
import { fetchCopies, createCopy, getBarcodeUrl, type Copy, type CopyCreate } from '../api/copies'
import { createLoan, returnLoan, type LoanCreate } from '../api/loans'
import { fetchAllSeries } from '../api/series'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import StarRating from '../components/StarRating'

export default function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()

  const { data: book, isLoading: bookLoading } = useQuery({
    queryKey: ['book', id],
    queryFn: () => fetchBook(id!),
    enabled: !!id,
  })

  usePageTitle(book?.title ?? 'Book')

  const { data: copies, isLoading: copiesLoading } = useQuery({
    queryKey: ['copies', id],
    queryFn: () => fetchCopies(id!),
    enabled: !!id,
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['book', id] }),
      queryClient.invalidateQueries({ queryKey: ['copies', id] }),
      queryClient.invalidateQueries({ queryKey: ['books'] }),
      queryClient.invalidateQueries({ queryKey: ['loans'] }),
    ])
  }

  // Mutations
  const toggleFav = useMutation({
    mutationFn: () => updateBook(id!, { is_favourite: !book?.is_favourite }),
    onSuccess: () => {
      toast.success(book?.is_favourite ? 'Removed from favourites' : 'Added to favourites')
      invalidate()
    },
  })

  const deleteBookMut = useMutation({
    mutationFn: () => deleteBook(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      toast.success('Book deleted')
      navigate('/')
    },
  })

  const editMut = useMutation({
    mutationFn: (data: Partial<BookCreate>) => updateBook(id!, data),
    onSuccess: () => {
      toast.success('Saved')
      setEditing(false)
      invalidate()
    },
    onError: () => toast.error('Failed to save'),
  })

  const [editing, setEditing] = useState(false)

  if (bookLoading) return <DetailSkeleton />
  if (!book) return <p className="py-20 text-center text-overlay0">Book not found.</p>

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link to="/" className="flex items-center gap-1.5 text-sm text-subtext0 hover:text-text w-fit">
        <ArrowLeft size={16} /> Browse
      </Link>

      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-6">
        <CoverImage book={book} />
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-text">{book.title}</h1>
              {book.subtitle && (
                <p className="text-base text-subtext0 mt-0.5">{book.subtitle}</p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => toggleFav.mutate()}
                className="p-2 rounded-lg hover:bg-surface1 transition-colors flex-shrink-0"
              >
                <Heart
                  size={22}
                  className={book.is_favourite ? 'fill-red text-red' : 'text-overlay1'}
                />
              </button>
            )}
          </div>

          {book.authors?.length ? (
            <p className="text-sm text-subtext1">{book.authors.join(', ')}</p>
          ) : null}

          <StarRating
            rating={book.rating ?? null}
            size={20}
            editable={isAdmin}
            onChange={(r) => editMut.mutate({ rating: r })}
          />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-2">
            <MetaItem label="Publisher" value={book.publisher} />
            <MetaItem label="Year" value={book.publish_date} />
            <MetaItem label="Pages" value={book.page_count?.toString()} />
            <MetaItem
              label="ISBN"
              value={book.isbn13 || book.isbn10}
            />
            <MetaItem label="Language" value={book.language} />
            {book.series_name && (
              <MetaItem
                label="Series"
                value={
                  <Link to={`/series/${book.series_id}`} className="text-blue hover:underline">
                    {book.series_name}
                    {book.series_position ? ` #${book.series_position}` : ''}
                  </Link>
                }
              />
            )}
          </div>

          {/* Genres + Tags */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {book.genres?.map((g) => (
              <span key={g} className="rounded-full bg-mauve/15 px-2.5 py-0.5 text-xs text-mauve">
                {g}
              </span>
            ))}
            {book.tags?.map((t) => (
              <span key={t} className="rounded-full bg-teal/15 px-2.5 py-0.5 text-xs text-teal">
                {t}
              </span>
            ))}
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg bg-surface0 px-3 py-2 text-xs text-subtext1 hover:bg-surface1"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Delete this book and all its copies?')) {
                    deleteBookMut.mutate()
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-red/10 px-3 py-2 text-xs text-red hover:bg-red/20"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Edit Form */}
      {editing && (
        <EditBookForm
          book={book}
          onSave={(data) => editMut.mutate(data)}
          onCancel={() => setEditing(false)}
          isPending={editMut.isPending}
        />
      )}

      {/* Description */}
      {!editing && book.description && (
        <Section title="Description">
          <p className="text-sm text-subtext1 leading-relaxed whitespace-pre-line">
            {book.description}
          </p>
        </Section>
      )}

      {/* Notes */}
      <NotesSection book={book} isAdmin={isAdmin} onSave={(n) => editMut.mutate({ notes: n })} />

      {/* Copies */}
      <Section title="Copies">
        {copiesLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-surface1" />
            ))}
          </div>
        ) : !copies?.length ? (
          <p className="text-sm text-overlay0">No copies recorded.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {copies.map((copy) => (
              <CopyCard key={copy.id} copy={copy} isAdmin={isAdmin} onMutated={invalidate} />
            ))}
          </div>
        )}
        {isAdmin && <AddCopyForm bookId={id!} onCreated={invalidate} />}
      </Section>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────── */

function CoverImage({ book }: { book: Book }) {
  const src = book.cover_local || book.cover_url
  return (
    <div className="w-full md:w-56 flex-shrink-0">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-mantle">
        {src ? (
          <img src={src} alt={book.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-overlay0 text-sm px-4 text-center">
            No cover
          </div>
        )}
      </div>
    </div>
  )
}

function MetaItem({
  label,
  value,
}: {
  label: string
  value?: string | React.ReactNode
}) {
  if (!value) return null
  return (
    <div>
      <span className="text-overlay1 text-xs">{label}</span>
      <div className="text-text">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text mb-3">{title}</h2>
      {children}
    </section>
  )
}

function NotesSection({
  book,
  isAdmin,
  onSave,
}: {
  book: Book
  isAdmin: boolean
  onSave: (notes: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(book.notes ?? '')

  if (!isAdmin && !book.notes) return null

  return (
    <Section title="Notes">
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-surface0 p-3 text-sm text-text outline-none focus:ring-2 focus:ring-mauve resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onSave(draft)
                setEditing(false)
              }}
              className="rounded-lg bg-mauve px-4 py-1.5 text-xs font-semibold text-crust hover:opacity-90"
            >
              Save
            </button>
            <button
              onClick={() => {
                setDraft(book.notes ?? '')
                setEditing(false)
              }}
              className="rounded-lg bg-surface0 px-4 py-1.5 text-xs text-subtext1 hover:bg-surface1"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="relative group">
          <p className="text-sm text-subtext1 whitespace-pre-line">
            {book.notes || <span className="text-overlay0 italic">No notes yet.</span>}
          </p>
          {isAdmin && (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 flex items-center gap-1 text-xs text-overlay1 hover:text-text"
            >
              <Pencil size={12} /> Edit notes
            </button>
          )}
        </div>
      )}
    </Section>
  )
}

function CopyCard({
  copy,
  isAdmin,
  onMutated,
}: {
  copy: Copy
  isAdmin: boolean
  onMutated: () => void
}) {
  const [loanForm, setLoanForm] = useState(false)
  const [borrower, setBorrower] = useState('')

  const loanMut = useMutation({
    mutationFn: (data: LoanCreate) => createLoan(copy.id, data),
    onSuccess: () => {
      toast.success('Loaned out')
      setLoanForm(false)
      setBorrower('')
      onMutated()
    },
    onError: () => toast.error('Failed to create loan'),
  })

  const returnMut = useMutation({
    mutationFn: () => returnLoan(copy.active_loan_id!),
    onSuccess: () => {
      toast.success('Returned')
      onMutated()
    },
    onError: () => toast.error('Failed to return'),
  })

  const conditionColor: Record<string, string> = {
    new: 'text-green bg-green/15',
    good: 'text-teal bg-teal/15',
    fair: 'text-yellow bg-yellow/15',
    poor: 'text-peach bg-peach/15',
    damaged: 'text-red bg-red/15',
  }

  return (
    <div className="rounded-lg bg-surface0 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-4">
        {/* Barcode */}
        <img
          src={getBarcodeUrl(copy.id, copy.barcode_format)}
          alt={copy.barcode}
          className="h-12 bg-white rounded px-1"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text font-mono">{copy.barcode}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {copy.location && (
              <span className="flex items-center gap-1 text-xs text-overlay1">
                <MapPin size={12} /> {copy.location}
              </span>
            )}
            {copy.condition && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  conditionColor[copy.condition.toLowerCase()] ?? 'text-overlay1 bg-surface1'
                }`}
              >
                {copy.condition}
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        {copy.is_on_loan ? (
          <span className="rounded-full bg-peach/15 px-3 py-1 text-xs font-medium text-peach whitespace-nowrap">
            Loaned to {copy.borrower_name}
          </span>
        ) : (
          <span className="rounded-full bg-green/15 px-3 py-1 text-xs font-medium text-green">
            Available
          </span>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          {copy.is_on_loan ? (
            <button
              onClick={() => returnMut.mutate()}
              disabled={returnMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-green/10 px-3 py-1.5 text-xs text-green hover:bg-green/20 disabled:opacity-50"
            >
              <Undo2 size={14} /> Return
            </button>
          ) : (
            <>
              {loanForm ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Borrower name"
                    value={borrower}
                    onChange={(e) => setBorrower(e.target.value)}
                    className="rounded-lg bg-mantle px-3 py-1.5 text-xs text-text outline-none focus:ring-2 focus:ring-mauve"
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      borrower.trim() &&
                      loanMut.mutate({ borrower_name: borrower.trim() })
                    }
                    disabled={loanMut.isPending || !borrower.trim()}
                    className="rounded-lg bg-peach px-3 py-1.5 text-xs font-semibold text-crust hover:opacity-90 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setLoanForm(false)
                      setBorrower('')
                    }}
                    className="text-xs text-overlay1 hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setLoanForm(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-peach/10 px-3 py-1.5 text-xs text-peach hover:bg-peach/20"
                >
                  <BookOpen size={14} /> Loan out
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AddCopyForm({ bookId, onCreated }: { bookId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CopyCreate>({
    location: '',
    condition: 'good',
  })

  const mut = useMutation({
    mutationFn: (data: CopyCreate) => createCopy(bookId, data),
    onSuccess: () => {
      toast.success('Copy added')
      setOpen(false)
      setForm({ location: '', condition: 'good' })
      onCreated()
    },
    onError: () => toast.error('Failed to add copy'),
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 rounded-lg bg-mauve/10 px-4 py-2 text-sm text-mauve hover:bg-mauve/20"
      >
        <Plus size={16} /> Add copy
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg bg-surface0 p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text">New Copy</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          placeholder="Location"
          value={form.location ?? ''}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="rounded-lg bg-mantle px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-mauve"
        />
        <select
          value={form.condition ?? 'good'}
          onChange={(e) => setForm({ ...form, condition: e.target.value })}
          className="rounded-lg bg-mantle px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-mauve"
        >
          <option value="new">New</option>
          <option value="like_new">Like New</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => mut.mutate(form)}
          disabled={mut.isPending}
          className="rounded-lg bg-mauve px-4 py-1.5 text-xs font-semibold text-crust hover:opacity-90 disabled:opacity-50"
        >
          {mut.isPending ? 'Adding...' : 'Add'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg bg-surface1 px-4 py-1.5 text-xs text-subtext1 hover:bg-surface2"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function EditBookForm({
  book,
  onSave,
  onCancel,
  isPending,
}: {
  book: Book
  onSave: (data: Partial<BookCreate>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const { data: seriesList } = useQuery({ queryKey: ['series'], queryFn: fetchAllSeries })

  const [form, setForm] = useState({
    title: book.title,
    subtitle: book.subtitle ?? '',
    authors: (book.authors ?? []).join(', '),
    publisher: book.publisher ?? '',
    publish_date: book.publish_date ?? '',
    description: book.description ?? '',
    page_count: book.page_count ?? '',
    language: book.language ?? '',
    cover_url: book.cover_url ?? '',
    isbn13: book.isbn13 ?? '',
    isbn10: book.isbn10 ?? '',
    genres: (book.genres ?? []).join(', '),
    tags: (book.tags ?? []).join(', '),
    series_id: book.series_id ?? '',
    series_position: book.series_position ?? '',
  })

  const input = (label: string, key: keyof typeof form, opts?: { type?: string; rows?: number }) => (
    <label className="block" key={key}>
      <span className="text-subtext1 text-xs">{label}</span>
      {opts?.rows ? (
        <textarea
          rows={opts.rows}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mauve"
        />
      ) : (
        <input
          type={opts?.type ?? 'text'}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mauve"
        />
      )}
    </label>
  )

  function handleSave() {
    onSave({
      title: form.title,
      subtitle: form.subtitle || undefined,
      authors: form.authors.split(',').map((s) => s.trim()).filter(Boolean),
      publisher: form.publisher || undefined,
      publish_date: form.publish_date || undefined,
      description: form.description || undefined,
      page_count: form.page_count ? Number(form.page_count) : undefined,
      language: form.language || undefined,
      cover_url: form.cover_url || undefined,
      isbn13: form.isbn13 || undefined,
      isbn10: form.isbn10 || undefined,
      genres: form.genres.split(',').map((s) => s.trim()).filter(Boolean),
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      series_id: form.series_id || undefined,
      series_position: form.series_position || undefined,
    })
  }

  return (
    <Section title="Edit Book">
      <div className="space-y-3 bg-surface0 rounded-lg p-4">
        {form.cover_url && (
          <div className="flex justify-center">
            <img src={form.cover_url} alt="Cover" className="h-32 rounded-lg object-contain" />
          </div>
        )}
        {input('Title', 'title')}
        {input('Subtitle', 'subtitle')}
        {input('Authors (comma-separated)', 'authors')}
        <div className="grid grid-cols-2 gap-3">
          {input('ISBN-13', 'isbn13')}
          {input('ISBN-10', 'isbn10')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {input('Publisher', 'publisher')}
          {input('Year', 'publish_date')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {input('Pages', 'page_count', { type: 'number' })}
          {input('Language', 'language')}
        </div>
        {input('Cover URL', 'cover_url')}
        {input('Description', 'description', { rows: 3 })}
        {input('Genres (comma-separated)', 'genres')}
        {input('Tags (comma-separated)', 'tags')}
        <div>
          <span className="text-subtext1 text-xs block mb-1">Series</span>
          <div className="flex gap-2">
            <select
              value={form.series_id}
              onChange={(e) => setForm({ ...form, series_id: e.target.value })}
              className="flex-1 bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mauve"
            >
              <option value="">None</option>
              {seriesList?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {form.series_id && (
              <input
                placeholder="Position (e.g. 1)"
                value={form.series_position}
                onChange={(e) => setForm({ ...form, series_position: e.target.value })}
                className="w-28 bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending || !form.title}
            className="rounded-lg bg-green px-4 py-2 text-sm font-semibold text-crust hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-surface1 px-4 py-2 text-sm text-subtext1 hover:bg-surface2"
          >
            Cancel
          </button>
        </div>
      </div>
    </Section>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-4 w-20 rounded bg-surface1" />
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-56 aspect-[2/3] rounded-xl bg-surface1" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-3/4 rounded bg-surface1" />
          <div className="h-4 w-1/2 rounded bg-surface1" />
          <div className="h-4 w-1/3 rounded bg-surface1" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded bg-surface1" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
