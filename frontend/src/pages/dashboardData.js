const asNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const asString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback
  const text = `${value}`.trim()
  return text || fallback
}

const formatLogLine = (entry) => {
  if (entry === null || entry === undefined) return ''
  if (typeof entry === 'string') return entry
  if (typeof entry !== 'object') return `${entry}`

  const time = asString(entry.time, '—')
  const level = asString(entry.level, '').toUpperCase()
  const message = asString(entry.message, '').trim()
  const header = level ? `${level} • ${time}` : time
  return message ? `${header} — ${message}` : header
}

const normalizePositions = (positions) => {
  if (!Array.isArray(positions)) return []

  return positions.map((position, index) => {
    const symbol = asString(position?.symbol, '—')
    const qtyRaw = asNumber(position?.qty, 0)
    const qty = Math.abs(qtyRaw)
    const side = asString(position?.side, qtyRaw < 0 ? 'Short' : 'Long')
    const entry = asNumber(position?.entry ?? position?.avg_entry ?? position?.avg_price, 0)
    const mark = asNumber(position?.mark ?? position?.current_price ?? entry, entry)
    const pnl = asNumber(position?.pnl, 0)

    return {
      id: asString(position?.id, `${symbol}-${index}`),
      symbol,
      side,
      qty,
      entry,
      mark,
      pnl,
    }
  })
}

const normalizeStrategies = (strategies) => {
  if (!Array.isArray(strategies)) return []

  return strategies.map((strategy, index) => {
    const latencyMs = strategy?.latencyMs ?? strategy?.latency_ms ?? null
    const state = asString(strategy?.state, 'paused')

    return {
      id: asString(strategy?.id, `strategy-${index}`),
      name: asString(strategy?.name, 'Stratégie'),
      symbol: asString(strategy?.symbol, '—'),
      performance: asNumber(strategy?.performance, 0),
      state: ['active', 'paused', 'error'].includes(state) ? state : 'paused',
      latencyMs: latencyMs === null ? null : asNumber(latencyMs, null),
    }
  })
}

const normalizeAlerts = (alerts) => {
  if (!Array.isArray(alerts)) return []

  return alerts.map((alert, index) => ({
    id: asString(alert?.id, `alert-${index}`),
    level: asString(alert?.level, 'warning'),
    time: asString(alert?.time, '—'),
    text: asString(alert?.text, '—'),
  }))
}

const normalizeAiSummary = (summary) => {
  if (!summary || typeof summary !== 'object') {
    return { headline: '', bullets: [], confidence: null }
  }

  const bullets = Array.isArray(summary.bullets)
    ? summary.bullets.map((item) => asString(item)).filter(Boolean)
    : []

  const confidence = summary.confidence
  const confidenceValue = Number.isFinite(Number(confidence)) ? Number(confidence) : null

  return {
    headline: asString(summary.headline, ''),
    bullets,
    confidence: confidenceValue,
  }
}

export const buildDashboardSnapshot = ({
  account,
  positions,
  logs,
  strategies,
  alerts,
  aiSummary,
} = {}) => {
  const normalizedPositions = normalizePositions(positions)

  const consolidatedMetrics = {
    equityTotal: asNumber(account?.equity, 0),
    pnlDay: asNumber(account?.pnl, 0),
    cashAvailable: asNumber(account?.cash ?? account?.buying_power, 0),
    openPositions: normalizedPositions.length,
  }

  const globalLogs = Array.isArray(logs)
    ? logs.map(formatLogLine).filter(Boolean).slice(-120)
    : []

  return {
    consolidatedMetrics,
    openPositions: normalizedPositions,
    globalLogs,
    liveStrategies: normalizeStrategies(strategies),
    realtimeAlerts: normalizeAlerts(alerts),
    aiDaySummary: normalizeAiSummary(aiSummary),
  }
}

