import api from './client'

export interface Loan {
  id: string
  copy_id: string
  borrower_name: string
  borrowed_date: string
  due_date?: string
  returned_date?: string
  notes?: string
  created_at?: string
  book_title?: string
  barcode?: string
  is_overdue: boolean
}

export interface LoanCreate {
  borrower_name: string
  borrowed_date?: string
  due_date?: string
  notes?: string
}

export const fetchActiveLoans = () =>
  api.get<Loan[]>('/loans').then((r) => r.data)

export const fetchLoanHistory = (borrower?: string) =>
  api
    .get<Loan[]>('/loans/history', { params: borrower ? { borrower } : undefined })
    .then((r) => r.data)

export const fetchBorrowers = () =>
  api.get<string[]>('/loans/borrowers').then((r) => r.data)

export interface BorrowerStats {
  name: string
  active_count: number
  total_count: number
  average_days: number | null
}

export const fetchBorrowerStats = () =>
  api.get<BorrowerStats[]>('/loans/borrowers/stats').then((r) => r.data)

export const createLoan = (copyId: string, data: LoanCreate) =>
  api.post<Loan>(`/loans/copy/${copyId}`, data).then((r) => r.data)

export const returnLoan = (loanId: string) =>
  api.put<Loan>(`/loans/${loanId}/return`).then((r) => r.data)

export const returnByBarcode = (barcode: string) =>
  api.put<Loan>(`/loans/return-by-barcode/${encodeURIComponent(barcode)}`).then((r) => r.data)
