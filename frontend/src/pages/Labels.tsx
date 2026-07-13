import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, ShieldAlert, Tags } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchCopiesByLocation, getBarcodeUrl, type Copy } from '../api/copies'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Labels() {
  usePageTitle('Print Labels')
  const { isAdmin } = useAuth()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: groups } = useQuery({
    queryKey: ['copies', 'locations'],
    queryFn: fetchCopiesByLocation,
    enabled: isAdmin,
  })
  const copies: Copy[] = (groups ?? []).flatMap((g) => g.copies)

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-subtext0">
        <ShieldAlert size={48} className="text-red" />
        <p className="text-lg">Admin access required.</p>
      </div>
    )
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCopies = copies.filter((c) => selected.has(c.id))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Print-only rendering of the label sheet */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #label-sheet, #label-sheet * { visibility: visible; }
          #label-sheet {
            display: grid !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            grid-template-columns: repeat(3, 1fr);
            gap: 0;
          }
          #label-sheet .label {
            border: 1px dashed #999;
            height: 37mm;
            padding: 3mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2mm;
            overflow: hidden;
            break-inside: avoid;
          }
          #label-sheet .label img { height: 12mm; background: white; }
          #label-sheet .label p { margin: 0; text-align: center; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <Tags size={24} className="text-mauve" /> Print Labels
        </h1>
        <button
          onClick={() => window.print()}
          disabled={selected.size === 0}
          className="px-4 py-2 bg-mauve text-base rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Printer size={16} /> Print {selected.size || ''}
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm print:hidden">
        <button
          onClick={() => setSelected(new Set(copies.map((c) => c.id)))}
          className="text-mauve hover:underline"
        >
          Select all
        </button>
        <button onClick={() => setSelected(new Set())} className="text-subtext0 hover:underline">
          Clear
        </button>
        <span className="text-subtext0">
          {selected.size} of {copies.length} selected
        </span>
      </div>

      <div className="space-y-1.5 print:hidden">
        {copies.map((copy) => (
          <label
            key={copy.id}
            className="flex items-center gap-3 rounded-lg bg-surface0 p-3 cursor-pointer hover:bg-surface1"
          >
            <input
              type="checkbox"
              checked={selected.has(copy.id)}
              onChange={() => toggle(copy.id)}
              className="accent-mauve"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text truncate">{copy.book_title ?? 'Unknown Book'}</p>
              <p className="text-xs text-overlay1 font-mono">
                {copy.barcode}
                {copy.location ? ` · ${copy.location}` : ''}
              </p>
            </div>
          </label>
        ))}
        {copies.length === 0 && (
          <p className="text-subtext0 text-center py-8">No copies to print labels for.</p>
        )}
      </div>

      {/* The sheet itself: hidden on screen, grid on paper */}
      <div id="label-sheet" className="hidden">
        {selectedCopies.map((copy) => (
          <div key={copy.id} className="label">
            <img src={getBarcodeUrl(copy.id, copy.barcode_format)} alt={copy.barcode} />
            <p style={{ fontSize: '8pt', fontFamily: 'monospace' }}>{copy.barcode}</p>
            <p style={{ fontSize: '7pt' }}>{copy.book_title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
