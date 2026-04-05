import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { BookCheck, RotateCcw, Clock, History } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchActiveLoans, fetchLoanHistory, returnLoan, type Loan } from '../api/loans'
import { usePageTitle } from '../hooks/usePageTitle'

type Tab = 'active' | 'history'

export default function Loans() {
  usePageTitle('Loans')
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('active')

  const { data: active, isLoading: loadingActive } = useQuery({
    queryKey: ['loans', 'active'],
    queryFn: fetchActiveLoans,
  })

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['loans', 'history'],
    queryFn: fetchLoanHistory,
    enabled: tab === 'history',
  })

  const returnMutation = useMutation({
    mutationFn: returnLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      toast.success('Book returned!')
    },
    onError: () => toast.error('Failed to return book.'),
  })

  const tabCls = (t: Tab) =>
    `flex-1 py-2.5 text-center font-medium rounded-lg transition-colors ${
      tab === t ? 'bg-mauve text-base' : 'text-subtext0 hover:text-text'
    }`

  function formatDate(d?: string) {
    if (!d) return ''
    return new Date(d).toLocaleDateString()
  }

  function LoanRow({ loan, showReturned }: { loan: Loan; showReturned?: boolean }) {
    return (
      <div className="bg-surface0 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-text font-medium truncate">{loan.book_title ?? 'Unknown Book'}</p>
          <p className="text-subtext0 text-sm">
            Borrower: <span className="text-text">{loan.borrower_name}</span>
          </p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-subtext1">
            <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(loan.borrowed_date)}</span>
            {loan.barcode && <span>Barcode: {loan.barcode}</span>}
            {showReturned && loan.returned_date && (
              <span className="text-green">Returned: {formatDate(loan.returned_date)}</span>
            )}
          </div>
        </div>
        {!loan.returned_date && isAdmin && (
          <button
            onClick={() => returnMutation.mutate(loan.id)}
            disabled={returnMutation.isPending}
            className="px-3 py-2 bg-green text-base rounded-lg font-medium flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            <RotateCcw size={14} /> Return
          </button>
        )}
        {loan.returned_date && (
          <span className="text-green text-sm font-medium flex items-center gap-1 shrink-0">
            <BookCheck size={14} /> Returned
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <BookCheck size={24} className="text-mauve" /> Loans
      </h1>

      <div className="flex gap-2 bg-surface0 rounded-lg p-1">
        <button className={tabCls('active')} onClick={() => setTab('active')}>
          <Clock size={16} className="inline mr-1" /> Active
        </button>
        <button className={tabCls('history')} onClick={() => setTab('history')}>
          <History size={16} className="inline mr-1" /> History
        </button>
      </div>

      {tab === 'active' && (
        <div className="space-y-2">
          {loadingActive && <p className="text-subtext0">Loading...</p>}
          {active?.map((loan) => <LoanRow key={loan.id} loan={loan} />)}
          {active?.length === 0 && <p className="text-subtext0 text-center py-8">No active loans.</p>}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {loadingHistory && <p className="text-subtext0">Loading...</p>}
          {history?.map((loan) => <LoanRow key={loan.id} loan={loan} showReturned />)}
          {history?.length === 0 && <p className="text-subtext0 text-center py-8">No loan history.</p>}
        </div>
      )}
    </div>
  )
}
