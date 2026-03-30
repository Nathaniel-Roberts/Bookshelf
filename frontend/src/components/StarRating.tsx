import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number | null
  editable?: boolean
  onChange?: (rating: number) => void
  size?: number
}

export default function StarRating({
  rating,
  editable = false,
  onChange,
  size = 16,
}: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!editable}
          onClick={() => editable && onChange?.(star)}
          className={`${editable ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform disabled:opacity-100`}
        >
          <Star
            size={size}
            className={
              rating !== null && star <= (rating ?? 0)
                ? 'fill-yellow text-yellow'
                : 'fill-none text-surface2'
            }
          />
        </button>
      ))}
    </div>
  )
}
