import { Suspense, lazy, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Moon, Sun, Menu, X } from 'lucide-react'
import { useWealth } from './context/WealthContext'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Assets = lazy(() => import('./pages/Assets'))
const Bitcoin = lazy(() => import('./pages/Bitcoin'))
const Stocks = lazy(() => import('./pages/Stocks'))
const Projections = lazy(() => import('./pages/Projections'))
const Statistics = lazy(() => import('./pages/Statistics'))

const navItems = [
  { to: '/dashboard',    label: '📊 Dashboard' },
  { to: '/estadisticas', label: '📉 Estadísticas' },
  { to: '/assets',       label: '💼 Activos' },
  { to: '/bitcoin',      label: '₿ Bitcoin' },
  { to: '/stocks',       label: '📈 Acciones' },
  { to: '/proyecciones', label: '🎯 Proyecciones' },
]

const PageLoader = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
  </div>
)

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { darkMode, setDarkMode } = useWealth()
  const navigate = useNavigate()

  const activeClass    = 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
  const inactiveClass  = 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-300'
  const baseNavClass   = 'w-full text-left px-4 py-3 rounded-2xl font-semibold transition-colors'

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1
              className="text-2xl font-black dark:text-white cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              WealthHub
            </h1>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun size={20} className="text-yellow-500" />
                ) : (
                  <Moon size={20} className="text-slate-600" />
                )}
              </button>

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4`}
          >
            <nav className="space-y-2">
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `${baseNavClass} ${isActive ? activeClass : inactiveClass} block`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/"              element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"     element={<Dashboard />} />
                <Route path="/estadisticas"  element={<Statistics />} />
                <Route path="/assets"        element={<Assets />} />
                <Route path="/bitcoin"       element={<Bitcoin />} />
                <Route path="/stocks"        element={<Stocks />} />
                <Route path="/proyecciones"  element={<Projections />} />
                {/* Fallback: cualquier ruta desconocida vuelve al dashboard */}
                <Route path="*"              element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>

      </div>
    </div>
  )
}
