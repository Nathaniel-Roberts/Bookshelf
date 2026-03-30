import api from './client'

export interface Copy {
  id: string
  book_id: string
  barcode: string
  barcode_format: string
  location?: string
  condition?: string
  acquisition_date?: string
  acquisition_price?: number
  acquisition_source?: string
  notes?: string
  created_at?: string
  book_title?: string
  is_on_loan: boolean
  borrower_name?: string
  active_loan_id?: string
}

export interface CopyCreate {
  barcode_format?: string
  location?: string
  condition?: string
  acquisition_date?: string
  acquisition_price?: number
  acquisition_source?: string
  notes?: string
}

export const fetchCopies = (bookId: string) =>
  api.get<Copy[]>(`/copies/book/${bookId}`).then((r) => r.data)

export const fetchCopyByBarcode = (barcode: string) =>
  api.get<Copy>(`/copies/by-barcode/${barcode}`).then((r) => r.data)

export const createCopy = (bookId: string, data: CopyCreate) =>
  api.post<Copy>(`/copies/book/${bookId}`, data).then((r) => r.data)

export const updateCopy = (id: string, data: Partial<CopyCreate>) =>
  api.put<Copy>(`/copies/${id}`, data).then((r) => r.data)

export const deleteCopy = (id: string) => api.delete(`/copies/${id}`)

export const getBarcodeUrl = (copyId: string, format: string = 'code128') =>
  `/api/copies/${copyId}/barcode?format=${format}`
