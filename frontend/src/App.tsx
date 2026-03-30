import { Routes, Route } from 'react-router-dom'
import { AuthContext, useAuthState } from './hooks/useAuth'
import Layout from './components/Layout'
import Browse from './pages/Browse'
import BookDetail from './pages/BookDetail'
import AddBook from './pages/AddBook'
import SeriesList from './pages/SeriesList'
import SeriesDetail from './pages/SeriesDetail'
import Loans from './pages/Loans'
import Scan from './pages/Scan'
import History from './pages/History'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

export default function App() {
  const auth = useAuthState()

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Browse />} />
          <Route path="/books/:id" element={<BookDetail />} />
          <Route path="/books/add" element={<AddBook />} />
          <Route path="/series" element={<SeriesList />} />
          <Route path="/series/:id" element={<SeriesDetail />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/history" element={<History />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthContext.Provider>
  )
}
