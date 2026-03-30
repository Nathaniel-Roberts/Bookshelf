import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/client'

interface AuthContextType {
  isAdmin: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  login: async () => false,
  logout: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthState(): AuthContextType {
  const [isAdmin, setIsAdmin] = useState(() => !!localStorage.getItem('admin_token'))

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const { data } = await api.post('/auth/login', { password })
      localStorage.setItem('admin_token', data.token)
      setIsAdmin(true)
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token')
    setIsAdmin(false)
  }, [])

  return { isAdmin, login, logout }
}
