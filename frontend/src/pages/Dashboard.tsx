import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import { BookOpen, Copy, BookCheck, Users, Library, TrendingUp } from 'lucide-react'
import { fetchBooks } from '../api/books'
import { fetchActiveLoans } from '../api/loans'
import { fetchAllSeries } from '../api/series'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Dashboard() {
  usePageTitle('Dashboard')
  const { data: books } = useQuery({ queryKey: ['books'], queryFn: () => fetchBooks() })
  const { data: activeLoans } = useQuery({ queryKey: ['loans', 'active'], queryFn: fetchActiveLoans })
  const { data: series } = useQuery({ queryKey: ['series'], queryFn: fetchAllSeries })

  const totalBooks = books?.length ?? 0
  const totalCopies = books?.reduce((sum, b) => sum + b.copy_count, 0) ?? 0
  const onLoan = activeLoans?.length ?? 0
  const uniqueAuthors = new Set(books?.flatMap((b) => b.authors ?? []) ?? []).size
  const totalSeries = series?.length ?? 0

  // Genre chart
  const genreCounts: Record<string, number> = {}
  books?.forEach((b) => b.genres?.forEach((g) => { genreCounts[g] = (genreCounts[g] ?? 0) + 1 }))
  const genreData = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  // Rating chart
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  books?.forEach((b) => { if (b.rating) ratingCounts[b.rating] = (ratingCounts[b.rating] ?? 0) + 1 })
  const ratingData = Object.entries(ratingCounts).map(([r, count]) => ({ name: `${r} star`, count }))

  // Recent additions
  const recent = (books ?? [])
    .slice()
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 10)

  const stats = [
    { label: 'Books', value: totalBooks, icon: BookOpen, color: 'text-blue' },
    { label: 'Copies', value: totalCopies, icon: Copy, color: 'text-green' },
    { label: 'On Loan', value: onLoan, icon: BookCheck, color: 'text-peach' },
    { label: 'Authors', value: uniqueAuthors, icon: Users, color: 'text-mauve' },
    { label: 'Series', value: totalSeries, icon: Library, color: 'text-yellow' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <TrendingUp size={24} className="text-mauve" /> Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface0 rounded-lg p-4 text-center">
            <s.icon size={20} className={`${s.color} mx-auto mb-1`} />
            <p className="text-2xl font-bold text-text">{s.value}</p>
            <p className="text-subtext0 text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {genreData.length > 0 && (
          <div className="bg-surface0 rounded-lg p-4">
            <h2 className="text-text font-semibold mb-3">Books by Genre</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={genreData}>
                <XAxis dataKey="name" tick={{ fill: '#a6adc8', fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#a6adc8', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#313244', border: 'none', borderRadius: 8, color: '#cdd6f4' }}
                />
                <Bar dataKey="count" fill="#cba6f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-surface0 rounded-lg p-4">
          <h2 className="text-text font-semibold mb-3">Rating Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ratingData}>
              <XAxis dataKey="name" tick={{ fill: '#a6adc8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#a6adc8', fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#313244', border: 'none', borderRadius: 8, color: '#cdd6f4' }}
              />
              <Bar dataKey="count" fill="#f9e2af" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent additions */}
      <div className="bg-surface0 rounded-lg p-4">
        <h2 className="text-text font-semibold mb-3">Recent Additions</h2>
        <div className="space-y-2">
          {recent.map((book) => (
            <Link
              key={book.id}
              to={`/books/${book.id}`}
              className="flex items-center gap-3 hover:bg-surface1 rounded-lg p-2 transition-colors"
            >
              {book.cover_url ? (
                <img src={book.cover_url} alt="" className="w-8 h-12 object-cover rounded" />
              ) : (
                <div className="w-8 h-12 bg-mantle rounded flex items-center justify-center">
                  <BookOpen size={14} className="text-overlay0" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm font-medium truncate">{book.title}</p>
                <p className="text-subtext0 text-xs truncate">{(book.authors ?? []).join(', ')}</p>
              </div>
              <span className="text-subtext1 text-xs shrink-0">
                {book.created_at ? new Date(book.created_at).toLocaleDateString() : ''}
              </span>
            </Link>
          ))}
          {recent.length === 0 && <p className="text-subtext0 text-sm">No books yet.</p>}
        </div>
      </div>

      {/* Currently on loan */}
      {activeLoans && activeLoans.length > 0 && (
        <div className="bg-surface0 rounded-lg p-4">
          <h2 className="text-text font-semibold mb-3">Currently on Loan</h2>
          <div className="space-y-2">
            {activeLoans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between p-2 hover:bg-surface1 rounded-lg transition-colors">
                <div>
                  <p className="text-text text-sm font-medium">{loan.book_title ?? 'Unknown'}</p>
                  <p className="text-subtext0 text-xs">to {loan.borrower_name}</p>
                </div>
                <span className="text-subtext1 text-xs">{new Date(loan.borrowed_date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
