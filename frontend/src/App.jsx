import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import History from './pages/History'
import Backtest from './pages/Backtest'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/history" element={<History />} />
            <Route path="/backtest" element={<Backtest />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}