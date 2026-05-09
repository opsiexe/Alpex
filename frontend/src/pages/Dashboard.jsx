import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  Briefcase,
  CircleDollarSign,
  PauseCircle,
  PlayCircle,
  Radio,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import {
  connectLogsWS,
  connectMetricsWS,
  getAccount,
  getDashboardAiSummary,
  getDashboardAlerts,
  getDashboardStrategies,
  getLogs,
  getPositions,
} from '../api/client'
import { buildDashboardSnapshot } from './dashboardData'

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

function formatPercent(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  const sign = amount > 0 ? '+' : ''
  return `${sign}${amount.toFixed(2)}%`
}

function logEntryToAlert(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null
  const levelRaw = `${entry.level || ''}`.toUpperCase()
  if (!['WARNING', 'WARN', 'ERROR', 'CRITICAL'].includes(levelRaw)) return null

  return {
    id: `${entry.time || 'alert'}-${levelRaw}-${index}`,
    level: levelRaw === 'ERROR' || levelRaw === 'CRITICAL' ? 'critical' : 'warning',
    time: `${entry.time || '—'}`,
    text: `${entry.message || ''}`.trim(),
  }
}

function StrategyStateBadge({ state }) {
  const map = {
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
    error: {
      label: 'Erreur',
      className: 'text-red-400 bg-red-500/10 border-red-500/30',
      icon: XCircle,
    },
  }

  const config = map[state] || map.paused
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${config.className}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

export default function Dashboard() {
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState(null)
  const [logs, setLogs] = useState(null)
  const [strategies, setStrategies] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [aiSummary, setAiSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setIsLoading(true)

      const [accountResult, positionsResult, logsResult, strategiesResult, alertsResult, aiSummaryResult] = await Promise.allSettled([
        getAccount(),
        getPositions(),
        getLogs(120),
        getDashboardStrategies(),
        getDashboardAlerts(20),
        getDashboardAiSummary(10),
      ])

      if (!isMounted) return

      const failed = [
        accountResult,
        positionsResult,
        logsResult,
        strategiesResult,
        alertsResult,
        aiSummaryResult,
      ].filter((result) => result.status === 'rejected').length

      if (accountResult.status === 'fulfilled') {
        setAccount(accountResult.value)
      }
      if (positionsResult.status === 'fulfilled') {
        setPositions(positionsResult.value)
      }
      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value)
      }
      if (strategiesResult.status === 'fulfilled') {
        setStrategies(strategiesResult.value)
      }
      if (alertsResult.status === 'fulfilled') {
        setAlerts(alertsResult.value)
      }
      if (aiSummaryResult.status === 'fulfilled') {
        setAiSummary(aiSummaryResult.value)
      }

      if (failed === 6) {
        setLoadError('Impossible de charger les données live du dashboard.')
      } else if (failed > 0) {
        setLoadError('Certaines données live n’ont pas pu être récupérées. Affichage partiel.')
      } else {
        setLoadError('')
      }

      setIsLoading(false)
    }

    const refreshPanels = async () => {
      const [strategiesResult, alertsResult, aiSummaryResult] = await Promise.allSettled([
        getDashboardStrategies(),
        getDashboardAlerts(20),
        getDashboardAiSummary(10),
      ])

      if (!isMounted) return

      if (strategiesResult.status === 'fulfilled') {
        setStrategies(strategiesResult.value)
      }
      if (alertsResult.status === 'fulfilled') {
        setAlerts(alertsResult.value)
      }
      if (aiSummaryResult.status === 'fulfilled') {
        setAiSummary(aiSummaryResult.value)
      }
    }

    loadDashboard()
    const refreshHandle = setInterval(refreshPanels, 15000)

    let metricsWs = null
    let logsWs = null

    try {
      metricsWs = connectMetricsWS((payload) => {
        if (!isMounted || !payload || typeof payload !== 'object') return
        setAccount(payload)
      })
    } catch {
      // silence volontaire: fallback REST déjà chargé
    }

    try {
      logsWs = connectLogsWS((payload) => {
        if (!isMounted || !payload || typeof payload !== 'object') return

        if (payload.type === 'history' && Array.isArray(payload.data)) {
          setLogs(payload.data)
          const mappedAlerts = payload.data
            .map((entry, index) => logEntryToAlert(entry, index))
            .filter(Boolean)
          if (mappedAlerts.length > 0) {
            setAlerts(mappedAlerts.slice(-20))
          }
          return
        }

        if (payload.type === 'log' && payload.data) {
          setLogs((prev) => {
            const base = Array.isArray(prev) ? prev : []
            return [...base, payload.data].slice(-200)
          })

          const newAlert = logEntryToAlert(payload.data)
          if (newAlert) {
            setAlerts((prev) => {
              const base = Array.isArray(prev) ? prev : []
              return [newAlert, ...base].slice(0, 50)
            })
          }
        }
      })
    } catch {
      // silence volontaire: fallback REST déjà chargé
    }

    return () => {
      isMounted = false
      clearInterval(refreshHandle)

      if (metricsWs) {
        try {
          metricsWs.close()
        } catch {
          // noop
        }
      }
      if (logsWs) {
        try {
          logsWs.close()
        } catch {
          // noop
        }
      }
    }
  }, [])

  const dashboardSnapshot = useMemo(() => buildDashboardSnapshot({
    account,
    positions,
    logs,
    strategies,
    alerts,
    aiSummary,
  }), [account, alerts, aiSummary, logs, positions, strategies])

  const {
    consolidatedMetrics,
    openPositions,
    globalLogs,
    liveStrategies,
    realtimeAlerts,
    aiDaySummary,
  } = dashboardSnapshot

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-1">Vue globale du portefeuille et supervision live des stratégies</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
              <Radio size={12} className="text-emerald-400 animate-pulse" />
              {isLoading ? 'Chargement...' : 'Métriques live'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
              <Activity size={12} className="text-violet-400" />
              Toutes stratégies
            </span>
          </div>
        </header>

        {loadError ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {loadError}
          </div>
        ) : null}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Equity totale</p>
              <Wallet size={14} className="text-violet-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{formatCurrency(consolidatedMetrics.equityTotal)}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">P&L du jour</p>
              <TrendingUp size={14} className={consolidatedMetrics.pnlDay >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            </div>
            <p className={`mt-2 text-2xl font-semibold ${consolidatedMetrics.pnlDay >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(consolidatedMetrics.pnlDay)}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Cash disponible</p>
              <CircleDollarSign size={14} className="text-cyan-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{formatCurrency(consolidatedMetrics.cashAvailable)}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Positions ouvertes</p>
              <Briefcase size={14} className="text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{consolidatedMetrics.openPositions}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Statut des stratégies actives</h2>
              <span className="text-xs text-zinc-500">Temps réel</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="text-xs text-zinc-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Stratégie</th>
                    <th className="text-left px-4 py-3 font-medium">Symbole</th>
                    <th className="text-right px-4 py-3 font-medium">Performance</th>
                    <th className="text-left px-4 py-3 font-medium">État</th>
                    <th className="text-right px-4 py-3 font-medium">Latence</th>
                  </tr>
                </thead>
                <tbody>
                  {liveStrategies.length === 0 ? (
                    <tr className="border-t border-zinc-800/80">
                      <td colSpan={5} className="px-4 py-5 text-center text-xs text-zinc-500">
                        Aucune donnée de stratégie live disponible.
                      </td>
                    </tr>
                  ) : (
                    liveStrategies.map((strategy) => (
                      <tr key={strategy.id} className="border-t border-zinc-800/80 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-zinc-200">{strategy.name}</td>
                        <td className="px-4 py-3 text-zinc-400 font-mono">{strategy.symbol}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${strategy.performance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPercent(strategy.performance)}
                        </td>
                        <td className="px-4 py-3">
                          <StrategyStateBadge state={strategy.state} />
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400">
                          {strategy.latencyMs ? `${strategy.latencyMs} ms` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Bot size={15} className="text-violet-400" />
                Résumé IA journée
              </h2>
              <span className="text-xs text-zinc-500">
                {aiDaySummary.confidence !== null ? `Confiance ${aiDaySummary.confidence}%` : 'Confiance —'}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {aiDaySummary.headline ? (
                <p className="text-sm text-zinc-200 leading-relaxed">{aiDaySummary.headline}</p>
              ) : (
                <p className="text-sm text-zinc-500 leading-relaxed">Aucun résumé IA live disponible pour le moment.</p>
              )}
              {aiDaySummary.bullets.length > 0 ? (
                <ul className="space-y-2">
                  {aiDaySummary.bullets.map((bullet) => (
                    <li key={bullet} className="text-xs text-zinc-400 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-400/80" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Positions ouvertes</h2>
              <span className="text-xs text-zinc-500">Snapshot live</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs text-zinc-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Symbole</th>
                    <th className="text-left px-4 py-3 font-medium">Sens</th>
                    <th className="text-right px-4 py-3 font-medium">Qté</th>
                    <th className="text-right px-4 py-3 font-medium">Entrée</th>
                    <th className="text-right px-4 py-3 font-medium">Mark</th>
                    <th className="text-right px-4 py-3 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.length === 0 ? (
                    <tr className="border-t border-zinc-800/80">
                      <td colSpan={6} className="px-4 py-5 text-center text-xs text-zinc-500">
                        Aucune position ouverte actuellement.
                      </td>
                    </tr>
                  ) : (
                    openPositions.map((position) => (
                      <tr key={position.id} className="border-t border-zinc-800/80 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-zinc-200 font-mono">{position.symbol}</td>
                        <td className={`px-4 py-3 ${position.side === 'Long' ? 'text-emerald-400' : 'text-amber-400'}`}>{position.side}</td>
                        <td className="px-4 py-3 text-right text-zinc-300">{position.qty.toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right text-zinc-400">{position.entry.toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right text-zinc-300">{position.mark.toLocaleString('fr-FR')}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${position.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(position.pnl)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Console logs globale</h2>
                <span className="text-xs text-zinc-500">Flux backend</span>
              </div>
              <div className="p-4 max-h-52 overflow-y-auto font-mono text-xs space-y-2">
                {globalLogs.length === 0 ? (
                  <p className="text-zinc-500 leading-relaxed">Aucun log live pour le moment.</p>
                ) : (
                  globalLogs.map((line, index) => (
                    <p key={`${index}-${line}`} className="text-zinc-400 leading-relaxed">{line}</p>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-400" />
                  Alertes temps réel
                </h2>
                <span className="text-xs text-zinc-500">Priorisées</span>
              </div>
              <div className="p-4 space-y-2.5">
                {realtimeAlerts.length === 0 ? (
                  <p className="text-xs text-zinc-500">Aucune alerte live disponible pour le moment.</p>
                ) : (
                  realtimeAlerts.map((alert) => {
                    const tone =
                      alert.level === 'critical'
                        ? 'border-red-500/40 bg-red-500/10 text-red-300'
                        : alert.level === 'warning'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'

                    return (
                      <div key={alert.id} className={`rounded-lg border px-3 py-2 ${tone}`}>
                        <p className="text-[11px] opacity-80 mb-1">{alert.time}</p>
                        <p className="text-xs leading-relaxed">{alert.text}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
