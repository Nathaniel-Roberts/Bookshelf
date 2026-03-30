import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BookOpen,
  Library,
  HandCoins,
  ScanBarcode,
  LayoutDashboard,
  Clock,
  Settings,
  Lock,
  Unlock,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import LoginModal from './LoginModal'

const navItems = [
  { to: '/', label: 'Browse', icon: BookOpen, adminOnly: false },
  { to: '/series', label: 'Series', icon: Library, adminOnly: false },
  { to: '/loans', label: 'Loans', icon: HandCoins, adminOnly: false },
  { to: '/scan', label: 'Scan', icon: ScanBarcode, adminOnly: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { to: '/history', label: 'History', icon: Clock, adminOnly: false },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export default function Layout() {
  const { isAdmin, login, logout } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  const handleAdminToggle = () => {
    if (isAdmin) {
      logout()
    } else {
      setShowLogin(true)
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-surface1 text-mauve font-medium'
        : 'text-subtext0 hover:bg-surface0 hover:text-text'
    }`

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 text-[10px] transition-colors ${
      isActive ? 'text-mauve font-medium' : 'text-subtext0'
    }`

  return (
    <>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={`hidden md:flex w-64 flex-col bg-mantle p-4 ${
            isAdmin ? 'border-l-2 border-mauve' : ''
          }`}
        >
          <h1 className="mb-6 px-3 text-xl font-bold text-text">Bookshelf</h1>

          <nav className="flex flex-1 flex-col gap-1">
            {visibleItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={handleAdminToggle}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-subtext0 transition-colors hover:bg-surface0 hover:text-text"
          >
            {isAdmin ? <Unlock size={18} /> : <Lock size={18} />}
            {isAdmin ? 'Admin Mode' : 'Locked'}
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0 px-4 py-4 md:px-8 md:py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-mantle px-2 py-2 md:hidden ${
          isAdmin ? 'border-b-2 border-mauve' : ''
        }`}
      >
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={mobileLinkClass}>
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={handleAdminToggle}
          className="flex flex-col items-center gap-0.5 text-[10px] text-subtext0"
        >
          {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
          {isAdmin ? 'Admin' : 'Lock'}
        </button>
      </nav>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={login}
      />
    </>
  )
}
