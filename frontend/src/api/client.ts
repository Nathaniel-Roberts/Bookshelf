import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Fired when the stored token is rejected so useAuth can flip isAdmin
// immediately instead of the UI staying in a broken admin mode.
export const AUTH_EXPIRED_EVENT = 'bookshelf:auth-expired'

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('admin_token')) {
      localStorage.removeItem('admin_token')
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

export default api
