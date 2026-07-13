import api from './client'

export type BookStatus = 'owned' | 'want' | 'reading' | 'read'

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  owned: 'Owned',
  want: 'Wishlist',
  reading: 'Reading',
  read: 'Read',
}

export interface Book {
  id: string
  isbn13?: string
  isbn10?: string
  title: string
  subtitle?: string
  authors?: string[]
  publisher?: string
  publish_date?: string
  description?: string
  page_count?: number
  cover_url?: string
  cover_local?: string
  genres?: string[]
  language?: string
  series_id?: string
  series_position?: string
  tags?: string[]
  status: BookStatus
  is_favourite: boolean
  rating?: number
  notes?: string
  metadata_source?: string
  created_at?: string
  updated_at?: string
  series_name?: string
  copy_count: number
  available_copies: number
}

export interface BookCreate {
  isbn13?: string
  isbn10?: string
  title: string
  subtitle?: string
  authors?: string[]
  publisher?: string
  publish_date?: string
  description?: string
  page_count?: number
  cover_url?: string
  genres?: string[]
  language?: string
  series_id?: string
  series_position?: string
  tags?: string[]
  status?: BookStatus
  is_favourite?: boolean
  rating?: number
  notes?: string
  metadata_source?: string
}

export const fetchBooks = (params?: Record<string, string>) =>
  api.get<Book[]>('/books', { params }).then((r) => r.data)

export const fetchBook = (id: string) =>
  api.get<Book>(`/books/${id}`).then((r) => r.data)

export const fetchBookByIsbn = (isbn: string) =>
  api.get<Book>(`/books/by-isbn/${encodeURIComponent(isbn)}`).then((r) => r.data)

export const createBook = (data: BookCreate) =>
  api.post<Book>('/books', data).then((r) => r.data)

export const updateBook = (id: string, data: Partial<BookCreate>) =>
  api.put<Book>(`/books/${id}`, data).then((r) => r.data)

export const deleteBook = (id: string) => api.delete(`/books/${id}`)

export const lookupIsbn = (isbn: string, source?: string) =>
  api.get(`/lookup/isbn/${isbn}`, { params: source ? { source } : undefined }).then((r) => r.data)

export interface BookFacets {
  genres: string[]
  tags: string[]
  authors: string[]
}

export const fetchFacets = () => api.get<BookFacets>('/books/facets').then((r) => r.data)

export interface BookStats {
  total_value: number
  priced_copies: number
}

export const fetchStats = () => api.get<BookStats>('/books/stats').then((r) => r.data)

export const renameTerm = (field: 'tags' | 'genres', oldTerm: string, newTerm: string | null) =>
  api
    .post<{ updated: number }>('/books/terms/rename', { field, old: oldTerm, new: newTerm })
    .then((r) => r.data)
