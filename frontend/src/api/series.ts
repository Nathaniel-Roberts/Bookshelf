import api from './client'

export interface Series {
  id: string
  name: string
  description?: string
  created_at?: string
  book_count: number
}

export interface SeriesCreate {
  name: string
  description?: string
}

export const fetchAllSeries = () =>
  api.get<Series[]>('/series').then((r) => r.data)

export const fetchSeries = (id: string) =>
  api.get<Series>(`/series/${id}`).then((r) => r.data)

export const createSeries = (data: SeriesCreate) =>
  api.post<Series>('/series', data).then((r) => r.data)

export const updateSeries = (id: string, data: Partial<SeriesCreate>) =>
  api.put<Series>(`/series/${id}`, data).then((r) => r.data)

export const deleteSeries = (id: string) => api.delete(`/series/${id}`)
