import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ScanBarcode, BookPlus, LogOut, LogIn, ShieldAlert, Camera, Hand, Search } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useScanner, useKeyboardScanner } from '../hooks/useScanner'
import { fetchCopyByBarcode } from '../api/copies'
import { createLoan, returnByBarcode, fetchBorrowers } from '../api/loans'
import { usePageTitle } from '../hooks/usePageTitle'

type Mode = 'add' | 'checkout' | 'return' | 'find'

export default function Scan() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('add')
  const [manualInput, setManualInput] = useState('')
  const [checkoutCopyId, setCheckoutCopyId] = useState<string | null>(null)
  const [checkoutBookTitle, setCheckoutBookTitle] = useState('')
  const [borrowerName, setBorrowerName] = useState('')
  const [dueDate, setDueDate] = useState('')

  usePageTitle('Scan')
  const { data: borrowers } = useQuery({ queryKey: ['borrowers'], queryFn: fetchBorrowers, enabled: isAdmin })

  const loanMutation = useMutation({
    mutationFn: ({ copyId, borrower, due }: { copyId: string; borrower: string; due?: string }) =>
      createLoan(copyId, { borrower_name: borrower, due_date: due || undefined }),
    onSuccess: () => {
      toast.success('Checked out!')
      setCheckoutCopyId(null)
      setBorrowerName('')
      setDueDate('')
    },
    onError: () => toast.error('Checkout failed.'),
  })

  const returnMutation = useMutation({
    mutationFn: returnByBarcode,
    onSuccess: (loan) => toast.success(`Returned: ${loan.book_title ?? loan.barcode}`),
    onError: (err) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Return failed.')
    },
  })

  const handleScan = useCallback(
    async (code: string) => {
      if (mode === 'add') {
        navigate(`/books/add?isbn=${encodeURIComponent(code)}`)
        return
      }

      if (mode === 'return') {
        returnMutation.mutate(code)
        return
      }

      try {
        const copy = await fetchCopyByBarcode(code)
        if (mode === 'find') {
          toast.success(
            copy.location
              ? `${copy.book_title ?? 'Unknown'} — lives at: ${copy.location}`
              : `${copy.book_title ?? 'Unknown'} — no location recorded`,
            { duration: 5000 },
          )
          navigate(`/books/${copy.book_id}`)
          return
        }
        setCheckoutCopyId(copy.id)
        setCheckoutBookTitle(copy.book_title ?? 'Unknown Book')
      } catch {
        toast.error('Copy not found for this barcode.')
      }
    },
    [mode, navigate, returnMutation],
  )

  const { elementId, isScanning, error: scanError, start, stop } = useScanner({ onScan: handleScan })
  // USB/Bluetooth barcode scanners type the code rapidly and press Enter
  useKeyboardScanner(handleScan)

  function handleManualSubmit() {
    if (!manualInput.trim()) return
    handleScan(manualInput.trim())
    setManualInput('')
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-subtext0">
        <ShieldAlert size={48} className="text-red" />
        <p className="text-lg">Admin access required.</p>
      </div>
    )
  }

  const modeCls = (m: Mode) =>
    `flex-1 py-2 text-center text-sm font-medium rounded-lg transition-colors ${
      mode === m ? 'bg-mauve text-base' : 'text-subtext0 hover:text-text'
    }`

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 min-h-screen flex flex-col">
      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <ScanBarcode size={24} className="text-mauve" /> Scanner
      </h1>

      {/* Mode selector */}
      <div className="flex gap-1 bg-surface0 rounded-lg p-1">
        <button className={modeCls('add')} onClick={() => setMode('add')}>
          <BookPlus size={14} className="inline mr-1" /> Add Book
        </button>
        <button className={modeCls('checkout')} onClick={() => setMode('checkout')}>
          <LogOut size={14} className="inline mr-1" /> Checkout
        </button>
        <button className={modeCls('return')} onClick={() => setMode('return')}>
          <LogIn size={14} className="inline mr-1" /> Return
        </button>
        <button className={modeCls('find')} onClick={() => setMode('find')}>
          <Search size={14} className="inline mr-1" /> Find
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex flex-col gap-4">
        <div
          id={elementId}
          className="w-full aspect-[4/3] bg-mantle rounded-lg overflow-hidden border border-surface1"
        />
        <div className="flex gap-2">
          {!isScanning ? (
            <button onClick={start} className="px-4 py-2 bg-blue text-base rounded-lg font-medium flex items-center gap-1">
              <Camera size={16} /> Start Camera
            </button>
          ) : (
            <button onClick={stop} className="px-4 py-2 bg-red text-base rounded-lg font-medium flex items-center gap-1">
              Stop
            </button>
          )}
        </div>
        {scanError && <p className="text-red text-sm">{scanError}</p>}

        {/* Manual fallback */}
        <div className="flex gap-2">
          <input
            autoFocus
            placeholder={mode === 'add' ? 'Enter ISBN' : 'Enter barcode'}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            className="flex-1 bg-surface0 border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
          />
          <button onClick={handleManualSubmit} className="px-4 py-2 bg-mauve text-base rounded-lg font-medium flex items-center gap-1">
            <Hand size={16} /> Go
          </button>
        </div>
      </div>

      {/* Checkout modal */}
      {checkoutCopyId && (
        <div className="fixed inset-0 bg-base/80 flex items-center justify-center p-4 z-50">
          <div className="bg-surface0 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-text">Checkout</h2>
            <p className="text-subtext0 text-sm">{checkoutBookTitle}</p>
            <input
              placeholder="Borrower name"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              list="borrower-suggestions"
              className="w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
            />
            <datalist id="borrower-suggestions">
              {borrowers?.map((b) => <option key={b} value={b} />)}
            </datalist>
            <label className="block">
              <span className="text-subtext0 text-xs">Due date (optional)</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  borrowerName &&
                  loanMutation.mutate({ copyId: checkoutCopyId, borrower: borrowerName, due: dueDate })
                }
                disabled={!borrowerName || loanMutation.isPending}
                className="flex-1 py-2 bg-green text-base rounded-lg font-medium disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => { setCheckoutCopyId(null); setBorrowerName(''); setDueDate('') }}
                className="flex-1 py-2 bg-surface1 text-text rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
