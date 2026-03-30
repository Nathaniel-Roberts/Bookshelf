import api from './client'

export interface Loan {
  id: string
  copy_id: string
  borrower_name: string
  borrowed_date: string
  returned_date?: string
  notes?: string
  created_at?: string
  book_title?: string
  barcode?: string
}

export interface LoanCreate {
  borrower_name: string
  borrowed_date?: string
  notes?: string
}

export const fetchActiveLoans = () =>
  api.get<Loan[]>('/loans').then((r) => r.data)

export const fetchLoanHistory = () =>
  api.get<Loan[]>('/loans/history').then((r) => r.data)

export const fetchBorrowers = () =>
  api.get<string[]>('/loans/borrowers').then((r) => r.data)

export const createLoan = (copyId: string, data: LoanCreate) =>
  api.post<Loan>(`/loans/copy/${copyId}`, data).then((r) => r.data)

export const returnLoan = (loanId: string) =>
  api.put<Loan>(`/loans/${loanId}/return`).then((r) => r.data)
