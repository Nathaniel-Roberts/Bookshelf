import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import type { Book } from '../api/books'
import StarRating from './StarRating'

interface BookCardProps {
  book: Book
}

export default function BookCard({ book }: BookCardProps) {
  const available = book.available_copies > 0

  return (
    <Link
      to={`/books/${book.id}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-surface0 shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {book.cover_url || book.cover_local ? (
          <img
            src={book.cover_local ?? book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mauve/30 to-blue/30">
            <span className="px-4 text-center text-sm font-medium text-subtext0">
              {book.title}
            </span>
          </div>
        )}

        {/* Favourite heart */}
        {book.is_favourite && (
          <div className="absolute top-2 right-2">
            <Heart size={20} className="fill-red text-red drop-shadow" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text">
          {book.title}
        </h3>
        {book.authors && book.authors.length > 0 && (
          <p className="line-clamp-1 text-xs text-subtext0">
            {book.authors.join(', ')}
          </p>
        )}

        {book.rating != null && (
          <StarRating rating={book.rating} size={14} />
        )}

        {/* Bottom row */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="rounded-full bg-surface1 px-2 py-0.5 text-xs text-subtext0">
            {book.copy_count} {book.copy_count === 1 ? 'copy' : 'copies'}
          </span>
          <span
            className={`text-xs font-medium ${available ? 'text-green' : 'text-peach'}`}
          >
            {available ? 'Available' : 'On Loan'}
          </span>
        </div>
      </div>
    </Link>
  )
}
