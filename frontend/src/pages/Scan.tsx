import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ScanBarcode,
  BookPlus,
  LogOut,
  LogIn,
  ShieldAlert,
  Camera,
  Hand,
  Search,
  Layers,
  X,
  Save,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useScanner, useKeyboardScanner } from '../hooks/useScanner'
import { fetchCopyByBarcode, createCopy } from '../api/copies'
import { createLoan, returnByBarcode, fetchBorrowers } from '../api/loans'
import { lookupIsbn, createBook, fetchBookByIsbn, type BookCreate } from '../api/books'
import { usePageTitle } from '../hooks/usePageTitle'

type Mode = 'add' | 'checkout' | 'return' | 'find'

interface BatchItem {
  isbn: string
  status: 'looking' | 'ready' | 'owned' | 'error' | 'saving' | 'saved'
  title?: string
  data?: BookCreate
  message?: string
}

export default function Scan() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('add')
  const [manualInput, setManualInput] = useState('')
  const [checkoutCopyId, setCheckoutCopyId] = useState<string | null>(null)
  const [checkoutBookTitle, setCheckoutBookTitle] = useState('')
  const [borrowerName, setBorrowerName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [batch, setBatch] = useState<BatchItem[]>([])
  const [savingBatch, setSavingBatch] = useState(false)
  // Ref mirror so the scanner callback sees the latest queue for dedupe
  const batchRef = useRef<BatchItem[]>([])
  useEffect(() => {
    batchRef.current = batch
  }, [batch])

  const updateBatchItem = (isbn: string, patch: Partial<BatchItem>) => {
    setBatch((prev) => prev.map((item) => (item.isbn === isbn ? { ...item, ...patch } : item)))
  }

  const enqueueBatchScan = useCallback(
    async (code: string) => {
      const isbn = code.trim().replace(/[-\s]/g, '')
      if (!isbn) return
      if (batchRef.current.some((item) => item.isbn === isbn)) {
        toast('Already in the queue.', { icon: 'ℹ️' })
        return
      }
      setBatch((prev) => [...prev, { isbn, status: 'looking' }])
      try {
        const owned = await fetchBookByIsbn(isbn)
        updateBatchItem(isbn, { status: 'owned', title: owned.title })
        return
      } catch {
        // not owned — look up metadata
      }
      try {
        const data = await lookupIsbn(isbn)
        updateBatchItem(isbn, { status: 'ready', title: data.title, data })
      } catch (err) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        updateBatchItem(isbn, { status: 'error', message: detail ?? 'Lookup failed' })
      }
    },
    [],
  )

  async function saveBatch() {
    setSavingBatch(true)
    let saved = 0
    for (const item of batchRef.current) {
      if (item.status !== 'ready' || !item.data) continue
      updateBatchItem(item.isbn, { status: 'saving' })
      try {
        const book = await createBook(item.data)
        try {
          await createCopy(book.id, {})
        } catch {
          // book saved without its first copy; still counts as saved
        }
        updateBatchItem(item.isbn, { status: 'saved' })
        saved++
      } catch (err) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        updateBatchItem(item.isbn, { status: 'error', message: detail ?? 'Save failed' })
      }
    }
    setSavingBatch(false)
    queryClient.invalidateQueries({ queryKey: ['books'] })
    queryClient.invalidateQueries({ queryKey: ['facets'] })
    toast.success(`Saved ${saved} book${saved === 1 ? '' : 's'}.`)
  }

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
        if (batchMode) {
          enqueueBatchScan(code)
        } else {
          navigate(`/books/add?isbn=${encodeURIComponent(code)}`)
        }
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
    [mode, batchMode, enqueueBatchScan, navigate, returnMutation],
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

      {/* Batch toggle — cataloguing a whole shelf without leaving the page */}
      {mode === 'add' && (
        <button
          onClick={() => setBatchMode(!batchMode)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm w-fit ${
            batchMode ? 'bg-mauve/20 text-mauve' : 'bg-surface0 text-subtext0 hover:text-text'
          }`}
        >
          <Layers size={14} />
          Batch mode {batchMode ? 'on — scans queue up here' : 'off'}
        </button>
      )}

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

        {/* Batch queue */}
        {mode === 'add' && batchMode && batch.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-subtext1">
                Queue ({batch.filter((i) => i.status === 'ready').length} ready of {batch.length})
              </h2>
              <button
                onClick={() => setBatch([])}
                disabled={savingBatch}
                className="text-xs text-subtext0 hover:text-text disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            {batch.map((item) => (
              <div key={item.isbn} className="flex items-center gap-2 bg-surface0 rounded-lg p-2.5">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    {
                      looking: 'bg-surface1 text-subtext0',
                      ready: 'bg-green/15 text-green',
                      owned: 'bg-blue/15 text-blue',
                      error: 'bg-red/15 text-red',
                      saving: 'bg-yellow/15 text-yellow',
                      saved: 'bg-green/15 text-green',
                    }[item.status]
                  }`}
                >
                  {item.status === 'looking' ? '…' : item.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{item.title ?? item.isbn}</p>
                  <p className="text-xs text-overlay1 font-mono">
                    {item.isbn}
                    {item.message ? ` — ${item.message}` : ''}
                  </p>
                </div>
                {item.status !== 'saving' && item.status !== 'saved' && (
                  <button
                    onClick={() => setBatch((prev) => prev.filter((i) => i.isbn !== item.isbn))}
                    disabled={savingBatch}
                    className="text-overlay0 hover:text-text shrink-0 disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={saveBatch}
              disabled={savingBatch || !batch.some((i) => i.status === 'ready')}
              className="w-full py-3 bg-green text-base rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingBatch ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save All ({batch.filter((i) => i.status === 'ready').length})
            </button>
          </div>
        )}
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
