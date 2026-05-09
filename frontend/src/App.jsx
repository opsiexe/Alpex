import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Markets from './pages/Markets'
import Settings from './pages/Settings'
import History from './pages/History'
import Backtest from './pages/Backtest'
import Strategies from './pages/Strategies'

const FULL_SCREEN_ROUTES = ['/markets']

function MainContent() {
  const { pathname } = useLocation()
  const isFullScreen = FULL_SCREEN_ROUTES.includes(pathname)

  return (
    <main className={`flex-1 min-w-0 ${isFullScreen ? 'overflow-hidden flex flex-col' : 'overflow-y-auto p-6'}`}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/history" element={<History />} />
        <Route path="/backtest" element={<Backtest />} />
      </Routes>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>
    </BrowserRouter>
  )
}
