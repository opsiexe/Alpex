import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CalendarRange,
  Download,
  Filter,
  Newspaper,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react'
import { exportTradeHistoryCsv, getTradeHistory, getTradeHistoryDetail } from '../api/client'

const SIDE_OPTIONS = [
  { value: '', label: 'Tous les côtés' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
]

const RESULT_OPTIONS = [
  { value: '', label: 'Tous les résultats' },
  { value: 'profit', label: 'Profit' },
  { value: 'loss', label: 'Perte' },
]

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return amount.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatNumber(value, max = 4) {
  const amount = Number(value || 0)
  return amount.toLocaleString('fr-FR', { maximumFractionDigits: max })
}

function SideBadge({ side }) {
  const isBuy = side === 'buy'
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-semibold ${isBuy
      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
      : 'text-rose-300 border-rose-500/40 bg-rose-500/10'}`}>
      {isBuy ? 'Buy' : 'Sell'}
    </span>
  )
}

function ResultBadge({ result }) {
  const isProfit = result === 'profit'
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-semibold ${isProfit
      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
      : 'text-red-300 border-red-500/40 bg-red-500/10'}`}>
      {isProfit ? 'Profit' : 'Perte'}
    </span>
  )
}

function TradeMomentChart({ candles }) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return <div className="text-xs text-zinc-500">Aucune donnée graphique disponible autour du trade.</div>
  }

  const width = 760
  const height = 180
  const padX = 12
  const padY = 14
  const closes = candles.map((c) => Number(c.close || 0))
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = Math.max(max - min, 1e-6)

  const points = candles.map((c, index) => {
    const x = padX + (index / Math.max(candles.length - 1, 1)) * (width - padX * 2)
    const y = height - padY - ((Number(c.close || 0) - min) / span) * (height - padY * 2)
    return `${x},${y}`
  }).join(' ')

  const markerIndex = Math.floor(candles.length / 2)
  const markerX = padX + (markerIndex / Math.max(candles.length - 1, 1)) * (width - padX * 2)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
        <defs>
          <linearGradient id="tradeLineGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        <line x1={markerX} y1={8} x2={markerX} y2={height - 8} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
        <polyline
          fill="none"
          stroke="url(#tradeLineGradient)"
          strokeWidth="2"
          points={points}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default function History() {
  const [filters, setFilters] = useState({
    start: '',
    end: '',
    symbol: '',
    strategy: '',
    side: '',
    result: '',
  })

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selectedTrade, setSelectedTrade] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const apiFilters = useMemo(() => ({
    ...filters,
    limit: 300,
  }), [filters])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getTradeHistory(apiFilters)
      setRows(Array.isArray(payload?.items) ? payload.items : [])
      setTotal(Number(payload?.total || 0))
      setStrategies(Array.isArray(payload?.strategies) ? payload.strategies : [])
    } catch (err) {
      setRows([])
      setTotal(0)
      setStrategies([])
      setError(err?.response?.data?.detail || 'Impossible de charger l’historique des trades.')
    } finally {
      setLoading(false)
    }
  }, [apiFilters])

  useEffect(() => {
    const handle = setTimeout(() => {
      loadHistory()
    }, 180)
    return () => clearTimeout(handle)
  }, [loadHistory])

  const openTradeDetail = useCallback(async (tradeId) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      const detail = await getTradeHistoryDetail(tradeId)
      setSelectedTrade(detail)
    } catch (err) {
      setSelectedTrade(null)
      setDetailError(err?.response?.data?.detail || 'Impossible de charger le détail du trade.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const onExportCsv = useCallback(async () => {
    try {
      const blob = await exportTradeHistoryCsv(apiFilters)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `trade-history-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Échec de l’export CSV.')
    }
  }, [apiFilters])

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100 relative">
      <div className="max-w-[1600px] mx-auto space-y-4 pb-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historique</h1>
            <p className="text-sm text-zinc-500 mt-1">Journal complet des trades exécutés avec filtres avancés et détail IA</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadHistory}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs font-semibold"
            >
              <Filter size={13} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/50 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 text-xs font-semibold"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-zinc-300 text-sm font-semibold">
            <SlidersHorizontal size={14} className="text-violet-400" />
            Filtres avancés
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <label className="text-xs text-zinc-500 space-y-1">
              Date début
              <div className="relative">
                <CalendarRange size={12} className="absolute left-2 top-2.5 text-zinc-500" />
                <input
                  type="date"
                  value={filters.start}
                  onChange={(e) => setFilters(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full pl-7 pr-2 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 text-xs outline-none focus:border-violet-500"
                />
              </div>
            </label>

            <label className="text-xs text-zinc-500 space-y-1">
              Date fin
              <div className="relative">
                <CalendarRange size={12} className="absolute left-2 top-2.5 text-zinc-500" />
                <input
                  type="date"
                  value={filters.end}
                  onChange={(e) => setFilters(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full pl-7 pr-2 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 text-xs outline-none focus:border-violet-500"
                />
              </div>
            </label>

            <label className="text-xs text-zinc-500 space-y-1">
              Symbole
              <input
                type="text"
                value={filters.symbol}
                onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                placeholder="AAPL"
                className="w-full px-2 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 text-xs outline-none focus:border-violet-500"
              />
            </label>

            <label className="text-xs text-zinc-500 space-y-1">
              Stratégie
              <select
                value={filters.strategy}
                onChange={(e) => setFilters(prev => ({ ...prev, strategy: e.target.value }))}
                className="w-full px-2 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 text-xs outline-none focus:border-violet-500"
              >
                <option value="">Toutes</option>
                {strategies.map((strategy) => (
                  <option key={strategy} value={strategy}>{strategy}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-zinc-500 space-y-1">
              Côté
              <select
                value={filters.side}
                onChange={(e) => setFilters(prev => ({ ...prev, side: e.target.value }))}
                className="w-full px-2 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 text-xs outline-none focus:border-violet-500"
              >
                {SIDE_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-zinc-500 space-y-1">
              Résultat
              <select
                value={filters.result}
                onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value }))}
                className="w-full px-2 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 text-xs outline-none focus:border-violet-500"
              >
                {RESULT_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Trades exécutés</h2>
            <span className="text-xs text-zinc-500">{loading ? 'Chargement…' : `${total} trade(s)`}</span>
          </div>

          {error && (
            <div className="px-4 py-3 text-xs text-red-300 border-b border-zinc-800 bg-red-500/10">{error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-xs text-zinc-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Symbole</th>
                  <th className="text-left px-4 py-3 font-medium">Stratégie</th>
                  <th className="text-left px-4 py-3 font-medium">Côté</th>
                  <th className="text-right px-4 py-3 font-medium">Qté</th>
                  <th className="text-right px-4 py-3 font-medium">Prix</th>
                  <th className="text-right px-4 py-3 font-medium">P&L réalisé</th>
                  <th className="text-left px-4 py-3 font-medium">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">Aucun trade pour ces filtres.</td>
                  </tr>
                ) : (
                  rows.map((trade) => (
                    <tr
                      key={trade.id}
                      className="border-t border-zinc-800/80 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                      onClick={() => openTradeDetail(trade.id)}
                    >
                      <td className="px-4 py-3 text-zinc-300">{formatDateTime(trade.executed_at)}</td>
                      <td className="px-4 py-3 text-zinc-200 font-mono">{trade.symbol}</td>
                      <td className="px-4 py-3 text-zinc-400">{trade.strategy}</td>
                      <td className="px-4 py-3"><SideBadge side={trade.side} /></td>
                      <td className="px-4 py-3 text-right text-zinc-300">{formatNumber(trade.qty)}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{formatNumber(trade.avg_price)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${Number(trade.realized_pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(trade.realized_pnl)}
                      </td>
                      <td className="px-4 py-3"><ResultBadge result={trade.result} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {(selectedTrade || detailLoading || detailError) && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/50">
          <aside className="h-full w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 overflow-y-auto">
            <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Détail trade</h3>
              <button
                type="button"
                onClick={() => { setSelectedTrade(null); setDetailError('') }}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {detailLoading && (
                <div className="text-sm text-zinc-500">Chargement du détail…</div>
              )}

              {detailError && (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{detailError}</div>
              )}

              {!detailLoading && selectedTrade && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                      <p className="text-xs text-zinc-500">Symbole</p>
                      <p className="text-sm text-zinc-100 mt-1 font-mono">{selectedTrade.symbol}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                      <p className="text-xs text-zinc-500">P&L réalisé</p>
                      <p className={`text-sm mt-1 font-semibold ${Number(selectedTrade.realized_pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(selectedTrade.realized_pnl)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <h4 className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2">
                      <TrendingUp size={12} className="text-cyan-400" />
                      Signal technique déclencheur
                    </h4>
                    <p className="text-sm text-zinc-200 leading-relaxed">{selectedTrade.technical_signal}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <h4 className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2">
                      <Bot size={12} className="text-violet-400" />
                      Explication IA du trade
                    </h4>
                    <p className="text-sm text-zinc-200 leading-relaxed">{selectedTrade.ai_trade_explanation}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <h4 className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2">
                      <Newspaper size={12} className="text-amber-400" />
                      Actu déclencheuse
                    </h4>
                    {selectedTrade.trigger_news ? (
                      <div className="space-y-1">
                        <p className="text-sm text-zinc-200">{selectedTrade.trigger_news.title}</p>
                        <p className="text-xs text-zinc-500">{selectedTrade.trigger_news.source || 'Source inconnue'}</p>
                        {selectedTrade.trigger_news.url && (
                          <a href={selectedTrade.trigger_news.url} target="_blank" rel="noreferrer" className="text-xs text-violet-400 hover:text-violet-300">
                            Ouvrir la source
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">Aucune actu reliée à cette exécution.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <h4 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Graphique au moment J</h4>
                    <TradeMomentChart candles={selectedTrade.chart} />
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
