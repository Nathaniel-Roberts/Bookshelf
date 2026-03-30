import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, ShieldAlert, Save, Download } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchSettings, updateSetting } from '../api/settings'
import api from '../api/client'

export default function Settings() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    enabled: isAdmin,
  })

  const [libraryName, setLibraryName] = useState('')
  const [isbnSource, setIsbnSource] = useState('openlibrary')
  const [barcodeFormat, setBarcodeFormat] = useState('code128')

  useEffect(() => {
    if (!settings) return
    const get = (key: string) => settings.find((s) => s.key === key)?.value ?? ''
    setLibraryName(get('library_name') || 'My Library')
    setIsbnSource(get('prefer_google_books') === 'true' ? 'google' : 'openlibrary')
    setBarcodeFormat(get('default_barcode_format') || 'code128')
  }, [settings])

  const mutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Setting saved!')
    },
    onError: () => toast.error('Failed to save setting.'),
  })

  function saveAll() {
    mutation.mutate({ key: 'library_name', value: libraryName })
    mutation.mutate({ key: 'prefer_google_books', value: isbnSource === 'google' ? 'true' : 'false' })
    mutation.mutate({ key: 'default_barcode_format', value: barcodeFormat })
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

        <button
          onClick={saveAll}
          disabled={mutation.isPending}
          className="w-full py-3 bg-green text-base rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={18} /> Save Settings
        </button>
      </div>

      {/* Backup */}
      <div className="bg-surface0 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text">Backup</h2>
        <p className="text-sm text-subtext0">Download a full JSON export of your library — books, copies, loans, series, and settings.</p>
        <button
          onClick={async () => {
            try {
              const resp = await api.post('/settings/backup', null, { responseType: 'blob' })
              const url = URL.createObjectURL(resp.data)
              const a = document.createElement('a')
              a.href = url
              const disposition = resp.headers['content-disposition'] ?? ''
              const match = disposition.match(/filename="?([^"]+)"?/)
              a.download = match?.[1] ?? 'bookshelf_backup.json'
              a.click()
              URL.revokeObjectURL(url)
              toast.success('Backup downloaded!')
            } catch {
              toast.error('Failed to create backup.')
            }
          }}
          className="w-full py-3 bg-blue text-base rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <Download size={18} /> Download Backup
        </button>
      </div>
    </div>
  )
}
