import api from './client'

export interface Setting {
  key: string
  value: string | null
}

export const fetchSettings = () =>
  api.get<Setting[]>('/settings').then((r) => r.data)

export const updateSetting = (key: string, value: string) =>
  api.put<Setting>(`/settings/${key}`, { value }).then((r) => r.data)
