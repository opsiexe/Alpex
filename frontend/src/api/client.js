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
export const startBot = () => api.post('/bot/start').then(r => r.data)
export const stopBot = () => api.post('/bot/stop').then(r => r.data)

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