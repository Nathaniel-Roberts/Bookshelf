import { Link } from 'react-router-dom'
import { BookX } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFound() {
  usePageTitle('Not Found')
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-subtext0">
      <BookX size={48} className="text-overlay0" />
      <p className="text-lg">Page not found</p>
      <Link to="/" className="text-mauve hover:underline text-sm">
        Back to Browse
      </Link>
    </div>
  )
}
