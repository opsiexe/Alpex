import { useMemo, useState } from 'react'
import {
  Activity,
  Bot,
  Copy,
  Filter,
  Layers,
  Pencil,
  PlayCircle,
  PauseCircle,
  Plus,
  Power,
  Search,
  Tag,
  Trash2,
} from 'lucide-react'

const STRATEGIES = [
  {
    id: 'alpha-ma',
    name: 'Alpha Crossover',
    type: 'MA Crossover',
    symbols: ['AAPL', 'MSFT', 'NVDA'],
    parameters: [
      { label: 'MA rapide', value: '12' },
      { label: 'MA lente', value: '48' },
      { label: 'Risk', value: '1.5%' },
    ],
    status: 'active',
    performance: { percent: 12.4, pnl: 8420 },
    tags: ['trend', 'actions'],
    ai: false,
    multi: false,
  },
  {
    id: 'rsi-rebound',
    name: 'RSI Rebound',
    type: 'RSI',
    symbols: ['BTCUSDT', 'ETHUSDT'],
    parameters: [
      { label: 'RSI min', value: '28' },
      { label: 'RSI max', value: '72' },
      { label: 'Levier', value: '2x' },
    ],
    status: 'paused',
    performance: { percent: -2.1, pnl: -740 },
    tags: ['crypto', 'mean-reversion'],
    ai: false,
    multi: false,
  },
  {
    id: 'ia-sentiment',
    name: 'Sentiment IA',
    type: 'IA pure',
    symbols: ['TSLA', 'NVDA', 'META'],
    parameters: [
      { label: 'Modèle', value: 'Gemini' },
      { label: 'Confiance', value: '78%' },
      { label: 'Horizon', value: '1D' },
    ],
    status: 'active',
    performance: { percent: 18.7, pnl: 15600 },
    tags: ['ia', 'actions', 'news'],
    ai: true,
    multi: false,
  },
  {
    id: 'multi-core',
    name: 'Multi-Asset Core',
    type: 'Multi-stratégies',
    symbols: ['SPY', 'QQQ', 'XAUUSD', 'EURUSD'],
    parameters: [
      { label: 'Allocation', value: 'Diversifiée' },
      { label: 'Rebalance', value: 'Hebdo' },
      { label: 'Mode', value: 'Système' },
    ],
    status: 'stopped',
    performance: { percent: 5.4, pnl: 4200 },
    tags: ['macro', 'fx', 'commodities'],
    ai: false,
    multi: true,
  },
  {
    id: 'scalping-ai',
    name: 'Scalping IA',
    type: 'IA + RSI',
    symbols: ['SOLUSDT', 'BNBUSDT', 'ADAUSDT'],
    parameters: [
      { label: 'Fenêtre', value: '2m' },
      { label: 'Stop', value: '0.6%' },
      { label: 'Target', value: '1.2%' },
    ],
    status: 'active',
    performance: { percent: 9.2, pnl: 3120 },
    tags: ['ia', 'crypto', 'scalp'],
    ai: true,
    multi: false,
  },
]

const STATUS_CONFIG = {
  active: {
    label: 'Actif',
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    icon: PlayCircle,
  },
  paused: {
    label: 'En pause',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    icon: PauseCircle,
  },
  stopped: {
    label: 'Arrêté',
    className: 'text-zinc-400 bg-zinc-700/40 border-zinc-600/40',
    icon: Power,
  },
}

function formatPercent(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  if (amount === 0) return '0.00%'
  const sign = amount > 0 ? '+' : ''
  return `${sign}${amount.toFixed(2)}%`
}

function formatCurrency(value) {
  const amount = Number(value)
  const safeAmount = Number.isFinite(amount) ? amount : 0
  return safeAmount.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getPerformanceTone(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount === 0) return 'text-zinc-300'
  return amount > 0 ? 'text-emerald-400' : 'text-red-400'
}

function StrategyStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.paused
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${config.className}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

function StrategyTypeBadge({ label, isAi }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold ${
      isAi ? 'text-violet-300 border-violet-500/40 bg-violet-500/10' : 'text-zinc-300 border-zinc-700/60 bg-zinc-800/40'
    }`}
    >
      {isAi ? <Bot size={12} /> : null}
      {label}
    </span>
  )
}

export default function Strategies() {
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [aiOnly, setAiOnly] = useState(false)

  const allTags = useMemo(() => {
    const tags = new Map()
    STRATEGIES.forEach((strategy) => {
      strategy.tags.forEach((tag) => {
        tags.set(tag, (tags.get(tag) || 0) + 1)
      })
    })
    return Array.from(tags.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [])

  const stats = useMemo(() => {
    const uniqueSymbols = new Set()
    const multiCount = STRATEGIES.filter((strategy) => strategy.multi).length
    const activeCount = STRATEGIES.filter((strategy) => strategy.status === 'active').length
    const aiCount = STRATEGIES.filter((strategy) => strategy.ai).length
    STRATEGIES.forEach((strategy) => {
      strategy.symbols.forEach((symbol) => uniqueSymbols.add(symbol))
    })
    return {
      total: STRATEGIES.length,
      active: activeCount,
      ai: aiCount,
      multi: multiCount,
      symbols: uniqueSymbols.size,
    }
  }, [])

  const filteredStrategies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return STRATEGIES.filter((strategy) => {
      if (aiOnly && !strategy.ai) return false
      if (statusFilter !== 'all' && strategy.status !== statusFilter) return false
      if (selectedTags.length > 0 && !selectedTags.every((tag) => strategy.tags.includes(tag))) return false
      if (!normalizedQuery) return true
      const searchable = `${strategy.name} ${strategy.type} ${strategy.symbols.join(' ')}`.toLowerCase()
      return searchable.includes(normalizedQuery)
    })
  }, [aiOnly, query, selectedTags, statusFilter])

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  const resetFilters = () => {
    setQuery('')
    setSelectedTags([])
    setStatusFilter('all')
    setAiOnly(false)
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Stratégies</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Gestion complète des stratégies, multi-stratégies et moteurs IA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/50 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 font-semibold"
            >
              <Plus size={14} />
              Nouvelle stratégie
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700/60 bg-zinc-900/60 text-zinc-200 hover:border-zinc-500/60"
            >
              <Bot size={14} className="text-violet-400" />
              Stratégie IA
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Total stratégies</p>
              <Layers size={14} className="text-violet-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{stats.total}</p>
            <p className="mt-1 text-xs text-zinc-500">dont {stats.multi} multi-stratégies</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Actives</p>
              <Activity size={14} className="text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">{stats.active}</p>
            <p className="mt-1 text-xs text-zinc-500">Start/Stop individuel</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Pilotées IA</p>
              <Bot size={14} className="text-violet-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{stats.ai}</p>
            <p className="mt-1 text-xs text-zinc-500">Stratégies auto-apprenantes</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Symboles couverts</p>
              <Tag size={14} className="text-cyan-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{stats.symbols}</p>
            <p className="mt-1 text-xs text-zinc-500">Multi-assets par stratégie</p>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Filter size={14} className="text-zinc-500" />
              Filtres avancés & tags intelligents
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher par nom, type, symbole"
                  className="pl-8 pr-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 w-64 focus:outline-none focus:ring-1 focus:ring-violet-500/60"
                />
              </div>
              <div className="relative">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="pl-8 pr-6 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500/60"
                >
                  <option value="all">Tous statuts</option>
                  <option value="active">Actives</option>
                  <option value="paused">En pause</option>
                  <option value="stopped">Arrêtées</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setAiOnly((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                  aiOnly
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                    : 'border-zinc-700/60 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500/70'
                }`}
              >
                <Bot size={13} className="text-violet-400" />
                IA uniquement
              </button>
              {(query || selectedTags.length > 0 || statusFilter !== 'all' || aiOnly) ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700/60 text-zinc-300 hover:border-zinc-500/70"
                >
                  Réinitialiser
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {allTags.map(([tag, count]) => {
              const selected = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                    selected
                      ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                      : 'border-zinc-700/60 text-zinc-400 hover:border-zinc-500/70'
                  }`}
                >
                  <Tag size={12} />
                  {tag}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Liste des stratégies configurées</h2>
              <p className="text-xs text-zinc-500 mt-1">CRUD complet, duplication, activation et suppression par stratégie.</p>
            </div>
            <span className="text-xs text-zinc-500">{filteredStrategies.length} / {STRATEGIES.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-xs text-zinc-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Stratégie</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Symboles</th>
                  <th className="text-left px-4 py-3 font-medium">Paramètres actifs</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                  <th className="text-right px-4 py-3 font-medium">Performance</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStrategies.length === 0 ? (
                  <tr className="border-t border-zinc-800/80">
                    <td colSpan={7} className="px-4 py-6 text-center text-xs text-zinc-500">
                      Aucune stratégie ne correspond aux filtres actifs.
                    </td>
                  </tr>
                ) : (
                  filteredStrategies.map((strategy) => {
                    const performanceClass = getPerformanceTone(strategy.performance.percent)
                    const startStopConfig = strategy.status === 'active'
                      ? {
                          label: 'Stop',
                          icon: PauseCircle,
                          className: 'text-rose-300 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20',
                        }
                      : {
                          label: 'Start',
                          icon: PlayCircle,
                          className: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20',
                        }
                    const StartStopIcon = startStopConfig.icon

                    return (
                      <tr key={strategy.id} className="border-t border-zinc-800/80 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-zinc-200 font-semibold">{strategy.name}</span>
                              {strategy.ai ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-violet-500/40 bg-violet-500/10 text-[11px] font-semibold text-violet-200">
                                  <Bot size={12} />
                                  IA
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {strategy.tags.map((tag) => (
                                <span
                                  key={`${strategy.id}-${tag}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 text-[10px] text-zinc-400"
                                >
                                  <Tag size={10} />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StrategyTypeBadge label={strategy.type} isAi={strategy.ai} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {strategy.symbols.map((symbol) => (
                              <span
                                key={`${strategy.id}-${symbol}`}
                                className="inline-flex items-center px-2 py-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 text-xs text-zinc-300 font-mono"
                              >
                                {symbol}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                            {strategy.parameters.map((param) => (
                              <span
                                key={`${strategy.id}-${param.label}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-zinc-700/60 bg-zinc-900/60"
                              >
                                <span className="text-zinc-500">{param.label}</span>
                                <span className="text-zinc-200">{param.value}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StrategyStatusBadge status={strategy.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-sm font-semibold ${performanceClass}`}>
                              {formatPercent(strategy.performance.percent)}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {formatCurrency(strategy.performance.pnl)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-700/60 text-xs text-zinc-300 hover:border-zinc-500/70"
                            >
                              <Copy size={12} />
                              Dupliquer
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-700/60 text-xs text-zinc-300 hover:border-zinc-500/70"
                            >
                              <Pencil size={12} />
                              Éditer
                            </button>
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold ${startStopConfig.className}`}
                            >
                              <StartStopIcon size={12} />
                              {startStopConfig.label}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200 hover:bg-rose-500/20"
                            >
                              <Trash2 size={12} />
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
