import { useState, Suspense, lazy } from 'react'
import { Moon, Sun, Menu, X } from 'lucide-react'
import { useWealth } from './context/WealthContext'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const History = lazy(() => import('./pages/History'))
const Assets = lazy(() => import('./pages/Assets'))
const Bitcoin = lazy(() => import('./pages/Bitcoin'))
const Stocks = lazy(() => import('./pages/Stocks'))
const Projections = lazy(() => import('./pages/Projections'))
const Statistics = lazy(() => import('./pages/Statistics'))

type TabType = 'dashboard' | 'history' | 'assets' | 'bitcoin' | 'stocks' | 'proyecciones' | 'estadisticas'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { darkMode, setDarkMode } = useWealth()

  const tabs = [
    { id: 'dashboard' as TabType, label: '📊 Dashboard', icon: '📊' },
    { id: 'history' as TabType, label: '📈 Historial', icon: '📈' },
    { id: 'estadisticas' as TabType, label: '📉 Estadísticas', icon: '📉' },
    { id: 'assets' as TabType, label: '💼 Activos', icon: '💼' },
    { id: 'bitcoin' as TabType, label: '₿ Bitcoin', icon: '₿' },
    { id: 'stocks' as TabType, label: '📈 Acciones', icon: '📈' },
    { id: 'proyecciones' as TabType, label: '🎯 Proyecciones', icon: '🎯' }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'history':
        return <History />
      case 'estadisticas':
        return <Statistics />
      case 'assets':
        return <Assets />
      case 'bitcoin':
        return <Bitcoin />
      case 'stocks':
        return <Stocks />
      case 'proyecciones':
        return <Projections />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-black dark:text-white">WealthHub</h1>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4`}>
            <nav className="space-y-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setSidebarOpen(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
            <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
              {renderContent()}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}
