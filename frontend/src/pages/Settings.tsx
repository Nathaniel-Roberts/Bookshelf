import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, ShieldAlert, Save, Download, Upload, FileSpreadsheet, Tags, Pencil, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchSettings, updateSetting } from '../api/settings'
import { fetchFacets, renameTerm } from '../api/books'
import api from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'

function TermManager() {
  const queryClient = useQueryClient()
  const { data: facets } = useQuery({ queryKey: ['facets'], queryFn: fetchFacets })

  const mutation = useMutation({
    mutationFn: ({ field, old, next }: { field: 'tags' | 'genres'; old: string; next: string | null }) =>
      renameTerm(field, old, next),
    onSuccess: ({ updated }, { old, next }) => {
      queryClient.invalidateQueries({ queryKey: ['facets'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      toast.success(
        next ? `Renamed "${old}" to "${next}" on ${updated} books.` : `Removed "${old}" from ${updated} books.`,
      )
    },
    onError: () => toast.error('Failed to update.'),
  })

  const termRow = (field: 'tags' | 'genres') => (term: string) => (
    <div key={term} className="flex items-center gap-2 bg-mantle rounded-lg px-3 py-1.5">
      <span className="flex-1 text-sm text-text truncate">{term}</span>
      <button
        onClick={() => {
          const next = window.prompt(`Rename "${term}" to (existing names merge):`, term)
          if (next && next.trim() && next.trim() !== term) {
            mutation.mutate({ field, old: term, next: next.trim() })
          }
        }}
        disabled={mutation.isPending}
        className="text-subtext0 hover:text-text disabled:opacity-50"
        title="Rename or merge"
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={() => {
          if (window.confirm(`Remove "${term}" from all books?`)) {
            mutation.mutate({ field, old: term, next: null })
          }
        }}
        disabled={mutation.isPending}
        className="text-subtext0 hover:text-red disabled:opacity-50"
        title="Remove from all books"
      >
        <X size={13} />
      </button>
    </div>
  )

  if (!facets || (facets.tags.length === 0 && facets.genres.length === 0)) return null

  return (
    <div className="bg-surface0 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text">Tags &amp; Genres</h2>
      <p className="text-sm text-subtext0">
        Rename fixes typos; renaming to an existing name merges the two.
      </p>
      {facets.tags.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-subtext1 uppercase tracking-wide">Tags</h3>
          {facets.tags.map(termRow('tags'))}
        </div>
      )}
      {facets.genres.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-subtext1 uppercase tracking-wide">Genres</h3>
          {facets.genres.map(termRow('genres'))}
        </div>
      )}
    </div>
  )
}

async function downloadFrom(path: string, fallbackName: string, successMessage: string) {
  try {
    const resp = await api.post(path, null, { responseType: 'blob' })
    const url = URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url
    const disposition = resp.headers['content-disposition'] ?? ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    a.download = match?.[1] ?? fallbackName
    a.click()
    URL.revokeObjectURL(url)
    toast.success(successMessage)
  } catch {
    toast.error('Download failed.')
  }
}

export default function Settings() {
  usePageTitle('Settings')
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    enabled: isAdmin,
  })

  // Saved values are derived from the query; edits overlay them until saved,
  // avoiding setState-in-effect.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const saved = (key: string) => settings?.find((s) => s.key === key)?.value ?? ''
  const libraryName = edits.libraryName ?? (saved('library_name') || 'My Library')
  const isbnSource =
    edits.isbnSource ?? (saved('prefer_google_books') === 'true' ? 'google' : 'openlibrary')
  const barcodeFormat = edits.barcodeFormat ?? (saved('default_barcode_format') || 'code128')
  const webhookUrl = edits.webhookUrl ?? saved('overdue_webhook_url')
  const setLibraryName = (v: string) => setEdits((e) => ({ ...e, libraryName: v }))
  const setIsbnSource = (v: string) => setEdits((e) => ({ ...e, isbnSource: v }))
  const setBarcodeFormat = (v: string) => setEdits((e) => ({ ...e, barcodeFormat: v }))
  const setWebhookUrl = (v: string) => setEdits((e) => ({ ...e, webhookUrl: v }))

  const mutation = useMutation({
    mutationFn: (entries: Array<{ key: string; value: string }>) =>
      Promise.all(entries.map(({ key, value }) => updateSetting(key, value))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setEdits({})
      toast.success('Settings saved!')
    },
    onError: () => toast.error('Failed to save settings.'),
  })

  function saveAll() {
    mutation.mutate([
      { key: 'library_name', value: libraryName },
      { key: 'prefer_google_books', value: isbnSource === 'google' ? 'true' : 'false' },
      { key: 'default_barcode_format', value: barcodeFormat },
      { key: 'overdue_webhook_url', value: webhookUrl.trim() },
    ])
  }

  async function testWebhook() {
    try {
      const { data } = await api.post('/settings/notify-overdue')
      if (data.sent) {
        toast.success(`Notification sent (${data.overdue} overdue).`)
      } else if (data.overdue === 0) {
        toast('Nothing overdue — no notification sent.', { icon: 'ℹ️' })
      } else {
        toast.error('Webhook not configured/saved, or the request failed.')
      }
    } catch {
      toast.error('Test failed.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-subtext0">
        <ShieldAlert size={48} className="text-red" />
        <p className="text-lg">Admin access required.</p>
      </div>
    )
  }

  if (isLoading) return <p className="text-subtext0 text-center py-8">Loading...</p>

  const toggleCls = (active: boolean) =>
    `px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
      active ? 'bg-mauve text-base' : 'bg-surface1 text-subtext0 hover:text-text'
    }`

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <SettingsIcon size={24} className="text-mauve" /> Settings
      </h1>

      <div className="bg-surface0 rounded-lg p-4 space-y-6">
        {/* Library name */}
        <label className="block">
          <span className="text-subtext1 text-sm">Library Name</span>
          <input
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
          />
        </label>

        {/* ISBN Source */}
        <div>
          <span className="text-subtext1 text-sm block mb-2">Preferred ISBN Source</span>
          <div className="flex gap-2">
            <button className={toggleCls(isbnSource === 'openlibrary')} onClick={() => setIsbnSource('openlibrary')}>
              Open Library
            </button>
            <button className={toggleCls(isbnSource === 'google')} onClick={() => setIsbnSource('google')}>
              Google Books
            </button>
          </div>
        </div>

        {/* Barcode format */}
        <div>
          <span className="text-subtext1 text-sm block mb-2">Default Barcode Format</span>
          <div className="flex gap-2">
            <button className={toggleCls(barcodeFormat === 'code128')} onClick={() => setBarcodeFormat('code128')}>
              Code128
            </button>
            <button className={toggleCls(barcodeFormat === 'qr')} onClick={() => setBarcodeFormat('qr')}>
              QR Code
            </button>
          </div>
        </div>

        {/* Overdue webhook */}
        <label className="block">
          <span className="text-subtext1 text-sm">Overdue notification webhook (optional)</span>
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://ntfy.sh/your-topic"
            className="mt-1 w-full bg-mantle border border-surface1 text-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mauve"
          />
          <span className="text-xs text-subtext0 mt-1 flex items-center justify-between">
            A daily plain-text digest of overdue loans is POSTed here.
            <button onClick={testWebhook} className="text-mauve hover:underline shrink-0 ml-2">
              Send test now
            </button>
          </span>
        </label>

        <button
          onClick={saveAll}
          disabled={mutation.isPending}
          className="w-full py-3 bg-green text-base rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={18} /> Save Settings
        </button>
      </div>

      {/* Tags & genres */}
      <TermManager />

      {/* Tools */}
      <div className="bg-surface0 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text">Tools</h2>
        <Link
          to="/labels"
          className="w-full py-3 bg-surface1 text-text rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-surface2 transition-colors"
        >
          <Tags size={18} /> Print Barcode Labels
        </Link>
      </div>

      {/* Backup */}
      <div className="bg-surface0 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text">Backup</h2>
        <p className="text-sm text-subtext0">Download a full JSON export of your library — books, copies, loans, series, and settings. The CSV export is a books spreadsheet for insurance lists and sharing.</p>
        <button
          onClick={() => downloadFrom('/settings/backup', 'bookshelf_backup.json', 'Backup downloaded!')}
          className="w-full py-3 bg-blue text-base rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <Download size={18} /> Download Backup
        </button>
        <button
          onClick={() => downloadFrom('/settings/export-csv', 'bookshelf_books.csv', 'CSV downloaded!')}
          className="w-full py-3 bg-teal text-base rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <FileSpreadsheet size={18} /> Export Books CSV
        </button>

        <p className="text-sm text-subtext0 pt-2">
          Restore replaces the whole library with the contents of a backup file. The previous
          state stays visible in History.
        </p>
        <label className="w-full py-3 bg-peach text-base rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer">
          <Upload size={18} /> Restore Backup
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              if (!window.confirm(`Replace the entire library with "${file.name}"?`)) return
              try {
                const payload = JSON.parse(await file.text())
                const { data } = await api.post('/settings/restore', payload)
                queryClient.invalidateQueries()
                const r = data.restored
                toast.success(`Restored ${r.books} books, ${r.copies} copies, ${r.loans} loans.`)
              } catch (err) {
                const detail =
                  (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                toast.error(
                  detail ?? (err instanceof SyntaxError ? 'Not a valid JSON file.' : 'Restore failed.'),
                )
              }
            }}
          />
        </label>
      </div>
    </div>
  )
}
