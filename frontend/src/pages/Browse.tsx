import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  Heart,
  SlidersHorizontal,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
} from 'lucide-react'
import { fetchBooks, type Book } from '../api/books'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchAllSeries } from '../api/series'
import BookCard from '../components/BookCard'
import StarRating from '../components/StarRating'

type ViewMode = 'grid' | 'list'
type Availability = 'all' | 'available' | 'on_loan'
type SortField = 'title' | 'authors' | 'created_at' | 'rating'
type SortOrder = 'asc' | 'desc'

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Browse() {
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('')
  const [tag, setTag] = useState('')
  const [seriesId, setSeriesId] = useState('')
  const [availability, setAvailability] = useState<Availability>('all')
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [sort, setSort] = useState<SortField>('title')
  const [order, setOrder] = useState<SortOrder>('asc')
  const [view, setView] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)

  usePageTitle('Browse')
  const debouncedSearch = useDebounce(search, 300)

  const filterParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (debouncedSearch) p.search = debouncedSearch
    if (genre) p.genre = genre
    if (tag) p.tag = tag
    if (seriesId) p.series_id = seriesId
    if (availability !== 'all') p.availability = availability
    if (favouritesOnly) p.favourites = 'true'
    p.sort = sort
    p.order = order
    return p
  }, [debouncedSearch, genre, tag, seriesId, availability, favouritesOnly, sort, order])

  const { data: books, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['books', filterParams],
    queryFn: () => fetchBooks(filterParams),
    placeholderData: (prev) => prev,
  })

  const { data: seriesList } = useQuery({
    queryKey: ['series'],
    queryFn: fetchAllSeries,
  })

  // Fetch all books (unfiltered) to derive complete genre/tag lists
  const { data: allBooks } = useQuery({
    queryKey: ['books'],
    queryFn: () => fetchBooks(),
  })

  const { genres, tags } = useMemo(() => {
    const source = allBooks ?? books
    if (!source) return { genres: [] as string[], tags: [] as string[] }
    const gs = new Set<string>()
    const ts = new Set<string>()
    source.forEach((b) => {
      b.genres?.forEach((g) => gs.add(g))
      b.tags?.forEach((t) => ts.add(t))
    })
    return { genres: [...gs].sort(), tags: [...ts].sort() }
  }, [allBooks, books])

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-overlay0" />
        <input
          type="text"
          placeholder="Search books..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg bg-surface0 py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-overlay0 outline-none focus:ring-2 focus:ring-mauve"
        />
      </div>

      {/* Filter toggle (mobile) + sort/view controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 rounded-lg bg-surface0 px-3 py-2 text-xs text-subtext1 hover:bg-surface1 md:hidden"
        >
          <SlidersHorizontal size={14} /> Filters
        </button>

        {/* Filter row — always visible on md+, toggled on mobile */}
        <div
          className={`${
            showFilters ? 'flex' : 'hidden'
          } md:flex flex-wrap items-center gap-2 w-full md:w-auto`}
        >
          <Select value={genre} onChange={setGenre} placeholder="Genre">
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>

          <Select value={tag} onChange={setTag} placeholder="Tag">
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          <Select value={seriesId} onChange={setSeriesId} placeholder="Series">
            {(seriesList ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          {/* Availability toggle */}
          <div className="flex rounded-lg overflow-hidden bg-surface0 text-xs">
            {(['all', 'available', 'on_loan'] as Availability[]).map((a) => (
              <button
                key={a}
                onClick={() => setAvailability(a)}
                className={`px-3 py-2 capitalize ${
                  availability === a
                    ? 'bg-mauve text-crust font-semibold'
                    : 'text-subtext0 hover:bg-surface1'
                }`}
              >
                {a === 'on_loan' ? 'On Loan' : a === 'all' ? 'All' : 'Available'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setFavouritesOnly(!favouritesOnly)}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs ${
              favouritesOnly
                ? 'bg-red/20 text-red'
                : 'bg-surface0 text-subtext0 hover:bg-surface1'
            }`}
          >
            <Heart size={14} className={favouritesOnly ? 'fill-red' : ''} /> Favourites
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onChange={(v) => setSort(v as SortField)} placeholder="Sort">
            <option value="title">Title</option>
            <option value="authors">Author</option>
            <option value="created_at">Date Added</option>
            <option value="rating">Rating</option>
          </Select>

          <button
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            className="p-2 rounded-lg bg-surface0 text-subtext0 hover:bg-surface1 hover:text-text transition-colors"
            title={order === 'asc' ? 'Ascending' : 'Descending'}
          >
            {order === 'asc' ? <ArrowUpNarrowWide size={16} /> : <ArrowDownNarrowWide size={16} />}
          </button>

          <div className="flex rounded-lg overflow-hidden bg-surface0">
            <button
              onClick={() => setView('grid')}
              className={`p-2 ${view === 'grid' ? 'bg-mauve text-crust' : 'text-subtext0 hover:bg-surface1'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 ${view === 'list' ? 'bg-mauve text-crust' : 'text-subtext0 hover:bg-surface1'}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonGrid />
      ) : !books?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-overlay0">
          <Search size={48} className="mb-4 opacity-40" />
          <p className="text-lg">No books found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : view === 'grid' ? (
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <div className={`flex flex-col gap-1 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {books.map((book) => (
            <BookListRow key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────── */

function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg bg-surface0 py-2 pl-3 pr-8 text-xs text-subtext1 outline-none focus:ring-2 focus:ring-mauve hover:bg-surface1 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-overlay0"
      />
    </div>
  )
}

function BookListRow({ book }: { book: Book }) {
  const coverSrc = book.cover_local || book.cover_url
  return (
    <Link
      to={`/books/${book.id}`}
      className="flex items-center gap-4 rounded-lg bg-surface0 p-3 hover:bg-surface1 transition-colors"
    >
      <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-mantle">
        {coverSrc ? (
          <img src={coverSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{book.title}</p>
        <p className="text-xs text-subtext0 truncate">{book.authors?.join(', ')}</p>
      </div>
      <StarRating rating={book.rating ?? null} size={12} />
      <span className="text-xs text-overlay1 w-12 text-right">
        {book.available_copies}/{book.copy_count}
      </span>
      <span
        className={`text-xs font-medium w-16 text-right ${
          book.available_copies > 0 ? 'text-green' : 'text-red'
        }`}
      >
        {book.available_copies > 0 ? 'Available' : 'On Loan'}
      </span>
    </Link>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex flex-col rounded-xl bg-surface0 overflow-hidden animate-pulse">
          <div className="aspect-[2/3] bg-surface1" />
          <div className="flex flex-col gap-2 p-3">
            <div className="h-3 w-3/4 rounded bg-surface1" />
            <div className="h-2.5 w-1/2 rounded bg-surface1" />
          </div>
        </div>
      ))}
    </div>
  )
}
