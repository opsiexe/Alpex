import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS = BASE.replace('http', 'ws')

const api = axios.create({ baseURL: `${BASE}/api` })

// REST
export const getAccount = () => api.get('/account').then(r => r.data)
export const getPositions = () => api.get('/positions').then(r => r.data)
export const getStatus = () => api.get('/bot/status').then(r => r.data)
export const getConfig = () => api.get('/config').then(r => r.data)
export const getLogs = (n=100) => api.get(`/logs?limit=${n}`).then(r => r.data)
export const getDashboardStrategies = () => api.get('/dashboard/strategies').then(r => r.data)
export const getDashboardAlerts = (limit = 20) => api.get(`/dashboard/alerts?limit=${limit}`).then(r => r.data)
export const getDashboardAiSummary = (limit = 10) => api.get(`/dashboard/ai-summary?limit=${limit}`).then(r => r.data)
export const startBot = () => api.post('/bot/start').then(r => r.data)
export const stopBot = () => api.post('/bot/stop').then(r => r.data)
export const getStrategies = () => api.get('/strategies').then(r => r.data)
export const startStrategy = (strategyId) => api.post(`/strategies/${encodeURIComponent(strategyId)}/start`).then(r => r.data)
export const stopStrategy = (strategyId) => api.post(`/strategies/${encodeURIComponent(strategyId)}/stop`).then(r => r.data)
export const updateStrategyConfig = (strategyId, payload) =>
  api.patch(`/strategies/${encodeURIComponent(strategyId)}/config`, payload).then(r => r.data)

// WebSockets
export const connectLogsWS = (onMsg) => {
  const ws = new WebSocket(`${WS}/ws/logs`)
  ws.onmessage = e => onMsg(JSON.parse(e.data))
  return ws
}

export const connectMetricsWS = (onMsg) => {
  const ws = new WebSocket(`${WS}/ws/metrics`)
  ws.onmessage = e => onMsg(JSON.parse(e.data))
  return ws
}

// Markets REST
export const getCandles = (symbol, tf, limit = 300) =>
  api.get(`/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=${limit}`).then(r => r.data)
export const searchSymbols = (query, limit = 20) =>
  api.get(`/symbols/search?q=${encodeURIComponent(query)}&limit=${limit}`).then(r => r.data)
export const getNews = (symbol, limit = 20) =>
  api.get(`/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`).then(r => r.data)
export const getMarketSummary = (symbol) =>
  api.get(`/market-summary?symbol=${encodeURIComponent(symbol)}`).then(r => r.data)
export const getMarketTrades = (symbol) =>
  api.get(`/trades?symbol=${encodeURIComponent(symbol)}`).then(r => r.data)

// History REST
export const getTradeHistory = (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      params.set(key, value)
    }
  })
  return api.get(`/trades/history?${params.toString()}`).then(r => r.data)
}

export const getTradeHistoryDetail = (tradeId) =>
  api.get(`/trades/history/${encodeURIComponent(tradeId)}`).then(r => r.data)

export const exportTradeHistoryCsv = (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      params.set(key, value)
    }
  })
  return api.get(`/trades/history/export?${params.toString()}`, { responseType: 'blob' }).then(r => r.data)
}

export const connectCandlesWS = (symbol, tf, onMsg, onOpen, onClose) => {
  const ws = new WebSocket(`${WS}/ws/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}`)
  if (onOpen) ws.onopen = onOpen
  if (onClose) ws.onclose = onClose
  ws.onmessage = e => { try { onMsg(JSON.parse(e.data)) } catch (err) { console.error('[CandlesWS] Failed to parse message', err) } }
  return ws
}

// --- Section News & IA ---

/**
 * Récupère les news analysées (Résumé global + Sentiments individuels) via REST.
 * Utile pour l'affichage initial de la page.
 */
export const getAnalyzedNews = (symbol, limit = 10) =>
  api.get(`/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`).then(r => r.data)

/**
 * Connexion WebSocket pour recevoir les analyses IA en temps réel.
 * @param {string} symbol - Le ticker (ex: AAPL)
 * @param {function} onMsg - Callback quand une nouvelle analyse arrive
 */
export const connectAINewsWS = (symbol, onMsg) => {
  const ws = new WebSocket(`${WS}/ws/ai-news?symbol=${encodeURIComponent(symbol)}`)

  ws.onmessage = e => {
    try {
      onMsg(JSON.parse(e.data))
    } catch (err) {
      console.error('[AINewsWS] Erreur parsing:', err)
    }
  }

  ws.onerror = (err) => console.error('[AINewsWS] Erreur connection:', err)

  return ws
}
