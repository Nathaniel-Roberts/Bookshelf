import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MapPin, HelpCircle } from 'lucide-react'
import { fetchCopiesByLocation, type Copy } from '../api/copies'
import { usePageTitle } from '../hooks/usePageTitle'

function CopyRow({ copy }: { copy: Copy }) {
  return (
    <Link
      to={`/books/${copy.book_id}`}
      className="flex items-center justify-between gap-3 rounded-lg bg-surface0 p-3 hover:bg-surface1 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-text truncate">{copy.book_title ?? 'Unknown Book'}</p>
        <p className="text-xs text-subtext0 font-mono">{copy.barcode}</p>
      </div>
      {copy.is_on_loan ? (
        <span className="shrink-0 rounded-full bg-peach/15 px-2.5 py-0.5 text-xs text-peach">
          with {copy.borrower_name}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-green/15 px-2.5 py-0.5 text-xs text-green">
          on shelf
        </span>
      )}
    </Link>
  )
}

export default function Locations() {
  usePageTitle('Shelves')
  const { data: groups, isLoading } = useQuery({
    queryKey: ['copies', 'locations'],
    queryFn: fetchCopiesByLocation,
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-text flex items-center gap-2">
        <MapPin size={24} className="text-mauve" /> Shelves
      </h1>

      {isLoading && <p className="text-subtext0">Loading...</p>}

      {groups?.map((group) => (
        <section key={group.location ?? '__none__'}>
          <h2 className="text-sm font-semibold text-subtext1 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            {group.location ?? (
              <>
                <HelpCircle size={14} /> No location set
              </>
            )}
            <span className="text-overlay0 font-normal normal-case">
              ({group.copies.length})
            </span>
          </h2>
          <div className="space-y-1.5">
            {group.copies.map((copy) => (
              <CopyRow key={copy.id} copy={copy} />
            ))}
          </div>
        </section>
      ))}

      {groups?.length === 0 && (
        <p className="text-subtext0 text-center py-8">
          No copies yet. Set a location on a copy to organise your shelves.
        </p>
      )}
    </div>
  )
}
