import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSettings } from '../api/settings'

export function useLibraryName() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
  })
  return data?.find((s) => s.key === 'library_name')?.value || 'Bookshelf'
}

export function usePageTitle(title: string) {
  const library = useLibraryName()
  useEffect(() => {
    document.title = title ? `${title} — ${library}` : library
  }, [title, library])
}
