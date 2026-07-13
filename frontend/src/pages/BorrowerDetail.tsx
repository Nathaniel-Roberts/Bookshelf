import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, User, RotateCcw, BookCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchLoanHistory, returnLoan, type Loan } from '../api/loans'
import { usePageTitle } from '../hooks/usePageTitle'

export default function BorrowerDetail() {
  const { name = '' } = useParams<{ name: string }>()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  usePageTitle(name || 'Borrower')

  const { data: loans, isLoading } = useQuery({
    queryKey: ['loans', 'history', name],
    queryFn: () => fetchLoanHistory(name),
    enabled: !!name,
  })

  const returnMutation = useMutation({
    mutationFn: returnLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      toast.success('Book returned!')
    },
    onError: () => toast.error('Failed to return book.'),
  })

  const active = (loans ?? []).filter((l) => !l.returned_date)
  const returned = (loans ?? []).filter((l) => l.returned_date)
  const averageDays = returned.length
    ? Math.round(
        returned.reduce(
          (sum, l) =>
            sum +
            (new Date(l.returned_date!).getTime() - new Date(l.borrowed_date).getTime()) / 86_400_000,
          0,
        ) / returned.length,
      )
    : null

  function LoanRow({ loan }: { loan: Loan }) {
    return (
      <div
        className={`bg-surface0 rounded-lg p-3 flex items-center gap-3 ${
          loan.is_overdue ? 'border border-red/60' : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-text text-sm font-medium truncate">{loan.book_title ?? 'Unknown Book'}</p>
          <p className="text-xs text-subtext0">
            {new Date(loan.borrowed_date).toLocaleDateString()}
            {loan.returned_date
              ? ` → ${new Date(loan.returned_date).toLocaleDateString()}`
              : loan.due_date
                ? ` · due ${new Date(loan.due_date).toLocaleDateString()}${loan.is_overdue ? ' (overdue)' : ''}`
                : ''}
          </p>
        </div>
        {!loan.returned_date && isAdmin && (
          <button
            onClick={() => returnMutation.mutate(loan.id)}
            disabled={returnMutation.isPending}
            className="px-3 py-1.5 bg-green text-base rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <RotateCcw size={12} /> Return
          </button>
        )}
        {loan.returned_date && (
          <BookCheck size={16} className="text-green shrink-0" />
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link to="/loans" className="flex items-center gap-1.5 text-sm text-subtext0 hover:text-text w-fit">
        <ArrowLeft size={16} /> Loans
      </Link>

      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <User size={24} className="text-mauve" /> {name}
      </h1>

      <p className="text-sm text-subtext0">
        {loans?.length ?? 0} loan{(loans?.length ?? 0) === 1 ? '' : 's'} total
        {active.length > 0 ? ` · ${active.length} out now` : ''}
        {averageDays !== null ? ` · keeps books ~${averageDays} days` : ''}
      </p>

      {isLoading && <p className="text-subtext0">Loading...</p>}

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-subtext1 uppercase tracking-wide">Out now</h2>
          {active.map((loan) => (
            <LoanRow key={loan.id} loan={loan} />
          ))}
        </section>
      )}

      {returned.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-subtext1 uppercase tracking-wide">Returned</h2>
          {returned.map((loan) => (
            <LoanRow key={loan.id} loan={loan} />
          ))}
        </section>
      )}

      {loans?.length === 0 && (
        <p className="text-subtext0 text-center py-8">No loans recorded for this borrower.</p>
      )}
    </div>
  )
}
