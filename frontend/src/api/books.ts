import api from './client'

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
  is_favourite?: boolean
  rating?: number
  notes?: string
  metadata_source?: string
}

export const fetchBooks = (params?: Record<string, string>) =>
  api.get<Book[]>('/books', { params }).then((r) => r.data)

export const fetchBook = (id: string) =>
  api.get<Book>(`/books/${id}`).then((r) => r.data)

export const createBook = (data: BookCreate) =>
  api.post<Book>('/books', data).then((r) => r.data)

export const updateBook = (id: string, data: Partial<BookCreate>) =>
  api.put<Book>(`/books/${id}`, data).then((r) => r.data)

export const deleteBook = (id: string) => api.delete(`/books/${id}`)

export const lookupIsbn = (isbn: string, source?: string) =>
  api.get(`/lookup/isbn/${isbn}`, { params: source ? { source } : undefined }).then((r) => r.data)
