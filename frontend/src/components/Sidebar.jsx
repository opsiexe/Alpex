import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  History,
  TestTubeDiagonal,
  Settings,
  Zap,
} from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/markets',   icon: TrendingUp,      label: 'Markets'   },
  { to: '/history',   icon: History,         label: 'Historique'},
  { to: '/backtest',  icon: TestTubeDiagonal,label: 'Backtest'  },
  { to: '/settings',  icon: Settings,        label: 'Paramètres'},
]

export default function Sidebar() {
  return (
    <aside className="w-16 flex flex-col items-center bg-zinc-950 border-r border-zinc-800 py-4 shrink-0">
      {/* Logo */}
      <div className="mb-8 flex items-center justify-center w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30">
        <Zap size={18} className="text-violet-400" />
      </div>

      {/* Nav links */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ` +
              (isActive
                ? 'bg-violet-600/20 text-violet-400'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-r-full" />
                )}
                <Icon size={18} />
                {/* Tooltip */}
                <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
