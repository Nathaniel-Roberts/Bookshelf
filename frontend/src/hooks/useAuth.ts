import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import api, { AUTH_EXPIRED_EVENT } from '../api/client'

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

  // The API client removes the token and fires this event on 401
  useEffect(() => {
    const onExpired = () => setIsAdmin(false)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  return { isAdmin, login, logout }
}
