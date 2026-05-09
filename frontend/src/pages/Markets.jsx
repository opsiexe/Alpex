import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CrosshairMode, LineStyle, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts'
// Assure-toi que ces imports correspondent à ton fichier client.js
import { getCandles, connectCandlesWS, searchSymbols, getNews, connectAINewsWS } from '../api/client'
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, RefreshCw,
  Activity, BarChart2, Layers, Radio, Bot, Newspaper,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', '3M']
const MACD_SIGNAL_PERIOD = 9
const TOP_WORLD_STOCKS = [
  { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla', exchange: 'NASDAQ' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway', exchange: 'NYSE' },
  { symbol: 'LLY', name: 'Eli Lilly', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa', exchange: 'NYSE' },
]

const INDICATORS = [
  { id: 'ma', label: 'MA', color: '#f59e0b' },
  { id: 'bb', label: 'BB', color: '#8b5cf6' },
  { id: 'rsi', label: 'RSI', color: '#06b6d4' },
  { id: 'macd', label: 'MACD', color: '#10b981' },
]

const CHART_COLORS = {
  bg: '#09090b',
  grid: '#18181b',
  text: '#a1a1aa',
  border: '#27272a',
  up: '#22c55e',
  down: '#ef4444',
  wick: '#52525b',
}

/* ── AI Sentiment badge ─────────────────────────────── */
function SentimentBadge({ sentiment, score }) {
  const config = {
    Bullish: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20', icon: <TrendingUp size={10} />, label: 'Bullish' },
    Bearish: { color: 'text-red-400 bg-red-400/10 border-red-500/20', icon: <TrendingDown size={10} />, label: 'Bearish' },
    Neutral: { color: 'text-zinc-400 bg-zinc-700/50 border-zinc-600/50', icon: <Minus size={10} />, label: 'Neutre' }
  }

  // Fallback sur Neutral si le sentiment n'est pas reconnu ou manquant
  const { color, icon, label } = config[sentiment] || config.Neutral

  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {icon} {label} {score ? `${score}%` : ''}
    </span>
  )
}

/* ── Score bar (Optionnelle, adaptée pour score 0-100) ── */
function ScoreBar({ score, sentiment }) {
  const pct = Math.max(0, Math.min(100, score || 50))
  const color = sentiment === 'Bullish' ? 'bg-emerald-500' : sentiment === 'Bearish' ? 'bg-red-500' : 'bg-zinc-500'
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-zinc-500">Impact: {pct}</span>
    </div>
  )
}

/* ── News item ───────────────────────────────────── */
function formatAgo(ts) {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return 'À l\'instant'
  if (diff < 60) return `${diff}min`
  return `${Math.floor(diff / 60)}h`
}

function NewsItem({ item }) {
  return (
    <div className="border-b border-zinc-800/70 pb-3 mb-3 last:border-0 last:mb-0 hover:bg-zinc-900/30 p-2 rounded-lg transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <a
          href={item.url || '#'}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-zinc-200 hover:text-white leading-snug line-clamp-2 flex-1 transition-colors font-medium"
        >
          {item.title}
        </a>
      </div>
      <div className="flex items-center justify-between mt-2">
        <SentimentBadge sentiment={item.ai_sentiment} score={item.ai_score} />
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span>{item.source}</span>
          <span>•</span>
          <span>{formatAgo(item.timestamp)}</span>
        </div>
      </div>
      <ScoreBar score={item.ai_score} sentiment={item.ai_sentiment} />
    </div>
  )
}

/* ── AI summary card ─────────────────────────────── */
function AISummaryCard({ summary, loading }) {
  // Détermine la couleur de bordure basée sur des mots clés (optionnel)
  const isPositive = summary?.toLowerCase().includes('bullish') || summary?.toLowerCase().includes('hausse')
  const isNegative = summary?.toLowerCase().includes('bearish') || summary?.toLowerCase().includes('baisse')
  const borderColor = isPositive ? 'border-emerald-500/30' : isNegative ? 'border-red-500/30' : 'border-zinc-700/50'

  return (
    <div className={`bg-gradient-to-b from-zinc-900 to-zinc-950 border ${borderColor} rounded-xl p-4 shadow-lg`}>
      <div className="flex items-center gap-2 mb-3">
        <Bot size={16} className="text-violet-400" />
        <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Gemini Insights</span>
        {loading && <RefreshCw size={12} className="text-violet-500 animate-spin ml-auto" />}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-2 bg-zinc-800 rounded animate-pulse w-full" />
          <div className="h-2 bg-zinc-800 rounded animate-pulse w-5/6" />
          <div className="h-2 bg-zinc-800 rounded animate-pulse w-4/6" />
        </div>
      ) : (
        <p className="text-xs text-zinc-300 leading-relaxed font-medium">
          {summary || 'En attente des données du marché...'}
        </p>
      )}
    </div>
  )
}

/* ── Helpers Mock ─────────────────────────────── */
function buildTradeMarkers(trades) {
  return trades.map((t) => ({
    time: Math.floor(t.timestamp / 1000),
    position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
    color: t.side === 'buy' ? '#22c55e' : '#ef4444',
    shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
    text: `${t.side === 'buy' ? '▲' : '▼'} ${t.qty}`,
    size: 1,
  }))
}

function generateDemoCandles(symbol, tf) {
  const tfMs = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800, '1M': 2592000, '3M': 7776000 }
  const step = tfMs[tf] || 3600
  const basePrice = { AAPL: 185, MSFT: 425, NVDA: 915, AMZN: 180, GOOGL: 170, META: 495, TSLA: 175, NFLX: 610, AMD: 165, INTC: 38 }[symbol] || 100
  const now = Math.floor(Date.now() / 1000)
  const count = 300
  const candles = []
  let price = basePrice
  for (let i = count; i >= 0; i--) {
    const t = now - i * step
    const volatility = basePrice * 0.005
    const open = price
    const close = price + (Math.random() - 0.49) * volatility * 2
    const high = Math.max(open, close) + Math.random() * volatility
    const low = Math.min(open, close) - Math.random() * volatility
    candles.push({ time: t, open: +open.toFixed(4), high: +high.toFixed(4), low: +low.toFixed(4), close: +close.toFixed(4) })
    price = close
  }
  return candles
}

function generateDemoTrades(candles) {
  return candles
    .filter((_, i) => i % 45 === 0)
    .map((c) => ({ timestamp: c.time * 1000, side: Math.random() > 0.5 ? 'buy' : 'sell', qty: +(Math.random() * 0.5 + 0.01).toFixed(3) }))
}


/* ═══════════════════════════════════════════════════
   Main Markets Page
═══════════════════════════════════════════════════ */
export default function Markets() {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const maSeriesRef = useRef(null)
  const bbUpperRef = useRef(null)
  const bbLowerRef = useRef(null)
  const rsiSeriesRef = useRef(null)
  const macdSeriesRef = useRef(null)
  const macdSignalRef = useRef(null)
  const tradeMarkersRef = useRef(null)

  const wsCandleRef = useRef(null)
  const wsAiRef = useRef(null) // Réf pour le WebSocket IA

  const [symbol, setSymbol] = useState('AAPL')
  const [timeframe, setTimeframe] = useState('1h')
  const [activeIndicators, setActiveIndicators] = useState({ ma: true, bb: false, rsi: false, macd: false })
  const [showSymbolMenu, setShowSymbolMenu] = useState(false)
  const [showTfMenu, setShowTfMenu] = useState(false)
  const [symbolSearch, setSymbolSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [priceChange, setPriceChange] = useState(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [showTrades, setShowTrades] = useState(true)
  const [candles, setCandles] = useState([])

  // State pour IA & News
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)

  /* ── Fetch News & AI Data via REST ── */
  const refreshNews = useCallback(async (targetSymbol) => {
    setNewsLoading(true)
    setSummaryLoading(true)
    try {
      // getNews appelle maintenant la route qui retourne l'objet complet de FastAPI
      const data = await getNews(targetSymbol, 15)

      if (data && data.global_summary) {
        setNews(data.news || [])
        setAiSummary(data.global_summary)
      } else {
        // Fallback si structure différente
        setNews(Array.isArray(data) ? data : [])
        setAiSummary("Analyse globale momentanément indisponible.")
      }
    } catch (err) {
      console.error("Failed to fetch AI News:", err)
      setAiSummary("Erreur de connexion avec le service IA.")
      setNews([])
    } finally {
      setNewsLoading(false)
      setSummaryLoading(false)
    }
  }, [])

  /* ── Compute MA ─────────────────────────────── */
  const computeMA = useCallback((data, period = 20) =>
    data.map((d, i) => {
      if (i < period - 1) return null
      const avg = data.slice(i - period + 1, i + 1).reduce((s, c) => s + c.close, 0) / period
      return { time: d.time, value: +avg.toFixed(4) }
    }).filter(Boolean), [])

  /* ── Compute Bollinger Bands ─────────────────── */
  const computeBB = useCallback((data, period = 20, mult = 2) => {
    const upper = [], lower = []
    data.forEach((d, i) => {
      if (i < period - 1) return
      const slice = data.slice(i - period + 1, i + 1)
      const mean = slice.reduce((s, c) => s + c.close, 0) / period
      const std = Math.sqrt(slice.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period)
      upper.push({ time: d.time, value: +(mean + mult * std).toFixed(4) })
      lower.push({ time: d.time, value: +(mean - mult * std).toFixed(4) })
    })
    return { upper, lower }
  }, [])

  /* ── Compute RSI ─────────────────────────────── */
  const computeRSI = useCallback((data, period = 14) => {
    const result = []
    for (let i = period; i < data.length; i++) {
      let gains = 0, losses = 0
      for (let j = i - period + 1; j <= i; j++) {
        const diff = data[j].close - data[j - 1].close
        if (diff > 0) gains += diff; else losses -= diff
      }
      const rs = gains / (losses || 1)
      result.push({ time: data[i].time, value: +(100 - 100 / (1 + rs)).toFixed(2) })
    }
    return result
  }, [])

  /* ── Compute MACD ─────────────────────────────── */
  const computeMACD = useCallback((data) => {
    const ema = (arr, p) => {
      const k = 2 / (p + 1)
      let e = arr[0].close
      return arr.map((d, i) => { if (i === 0) return { time: d.time, value: e }; e = d.close * k + e * (1 - k); return { time: d.time, value: +e.toFixed(4) } })
    }
    const ema12 = ema(data, 12)
    const ema26 = ema(data, 26)
    const macdLine = ema12.map((d, i) => ({ time: d.time, value: +(d.value - ema26[i].value).toFixed(4) })).slice(26)
    const k = 2 / (MACD_SIGNAL_PERIOD + 1)
    let sig = macdLine[0].value
    const signal = macdLine.map((d, i) => { if (i === 0) return { time: d.time, value: sig }; sig = d.value * k + sig * (1 - k); return { time: d.time, value: +sig.toFixed(4) } })
    return { macd: macdLine, signal }
  }, [])

  const setTradeMarkers = useCallback((markers) => {
    if (!candleSeriesRef.current) return
    if (typeof candleSeriesRef.current.setMarkers === 'function') {
      candleSeriesRef.current.setMarkers(markers)
      return
    }
    if (!tradeMarkersRef.current) {
      tradeMarkersRef.current = createSeriesMarkers(candleSeriesRef.current, markers)
      return
    }
    tradeMarkersRef.current.setMarkers(markers)
  }, [])

  /* ── Build / update indicator series ─────────── */
  const applyIndicators = useCallback((data) => {
    if (!chartRef.current || !candleSeriesRef.current) return

    // MA
    if (activeIndicators.ma) {
      if (!maSeriesRef.current) maSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      maSeriesRef.current.setData(computeMA(data))
    } else if (maSeriesRef.current) { chartRef.current.removeSeries(maSeriesRef.current); maSeriesRef.current = null }

    // BB
    if (activeIndicators.bb) {
      const { upper, lower } = computeBB(data)
      if (!bbUpperRef.current) {
        bbUpperRef.current = chartRef.current.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
        bbLowerRef.current = chartRef.current.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      }
      bbUpperRef.current.setData(upper); bbLowerRef.current.setData(lower)
    } else {
      if (bbUpperRef.current) { chartRef.current.removeSeries(bbUpperRef.current); bbUpperRef.current = null }
      if (bbLowerRef.current) { chartRef.current.removeSeries(bbLowerRef.current); bbLowerRef.current = null }
    }

    // RSI
    if (activeIndicators.rsi) {
      if (!rsiSeriesRef.current) {
        rsiSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, priceScaleId: 'rsi', priceLineVisible: false, lastValueVisible: true })
        chartRef.current.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, borderVisible: false })
      }
      rsiSeriesRef.current.setData(computeRSI(data))
    } else if (rsiSeriesRef.current) { chartRef.current.removeSeries(rsiSeriesRef.current); rsiSeriesRef.current = null }

    // MACD
    if (activeIndicators.macd) {
      const { macd, signal } = computeMACD(data)
      if (!macdSeriesRef.current) {
        macdSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, priceScaleId: 'macd', priceLineVisible: false, lastValueVisible: true })
        macdSignalRef.current = chartRef.current.addSeries(LineSeries, { color: '#f97316', lineWidth: 1, priceScaleId: 'macd', priceLineVisible: false, lastValueVisible: false })
        chartRef.current.priceScale('macd').applyOptions({ scaleMargins: { top: 0.88, bottom: 0 }, borderVisible: false })
      }
      macdSeriesRef.current.setData(macd); macdSignalRef.current.setData(signal)
    } else {
      if (macdSeriesRef.current) { chartRef.current.removeSeries(macdSeriesRef.current); macdSeriesRef.current = null }
      if (macdSignalRef.current) { chartRef.current.removeSeries(macdSignalRef.current); macdSignalRef.current = null }
    }
  }, [activeIndicators, computeMA, computeBB, computeRSI, computeMACD])

  /* ── Init chart ────────────────────────────── */
  useEffect(() => {
    if (!chartContainerRef.current) return
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: CHART_COLORS.bg }, textColor: CHART_COLORS.text, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: CHART_COLORS.grid }, horzLines: { color: CHART_COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART_COLORS.border },
      timeScale: { borderColor: CHART_COLORS.border, timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    })
    chartRef.current = chart

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up, downColor: CHART_COLORS.down, borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down, wickUpColor: CHART_COLORS.up, wickDownColor: CHART_COLORS.down,
    })
    candleSeriesRef.current = cs

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight })
    })
    ro.observe(chartContainerRef.current)

    return () => {
      ro.disconnect(); chart.remove(); chartRef.current = null; candleSeriesRef.current = null;
      maSeriesRef.current = null; bbUpperRef.current = null; bbLowerRef.current = null;
      rsiSeriesRef.current = null; macdSeriesRef.current = null; macdSignalRef.current = null;
      tradeMarkersRef.current = null;
    }
  }, [])

  /* ── Load Data (Candles + AI WS) ───────────────────────── */
  useEffect(() => {
    if (!candleSeriesRef.current) return
    let cancelled = false

    // Reset indicators
    ;[maSeriesRef, bbUpperRef, bbLowerRef, rsiSeriesRef, macdSeriesRef, macdSignalRef].forEach(r => {
      if (r.current && chartRef.current) { try { chartRef.current.removeSeries(r.current) } catch { } r.current = null }
    })

    const updatePriceData = (data) => {
      if (!data.length) return
      setCurrentPrice(data[data.length - 1].close)
      const first = data[0].close
      const last = data[data.length - 1].close
      setPriceChange(((last - first) / first) * 100)
    }

    // 1. Candles Load
    const loadCandles = async () => {
      try {
        const data = await getCandles(symbol, timeframe, 300)
        if (cancelled || !candleSeriesRef.current || !Array.isArray(data) || !data.length) return
        setCandles(data); candleSeriesRef.current.setData(data); updatePriceData(data)
        if (showTrades) setTradeMarkers(buildTradeMarkers(generateDemoTrades(data)))
        chartRef.current?.timeScale().fitContent()
      } catch {
        if (cancelled || !candleSeriesRef.current) return
        const fallback = generateDemoCandles(symbol, timeframe)
        setCandles(fallback); candleSeriesRef.current.setData(fallback); updatePriceData(fallback)
        if (showTrades) setTradeMarkers(buildTradeMarkers(generateDemoTrades(fallback)))
        chartRef.current?.timeScale().fitContent()
      }
    }
    loadCandles()

    // 2. Initial News & AI Load
    refreshNews(symbol)

    // 3. WebSockets
    if (wsCandleRef.current) { wsCandleRef.current.close(); wsCandleRef.current = null }
    if (wsAiRef.current) { wsAiRef.current.close(); wsAiRef.current = null }

    try {
      // WS Candles
      wsCandleRef.current = connectCandlesWS(
        symbol, timeframe,
        (msg) => {
          if (!candleSeriesRef.current || cancelled) return
          if (msg.type === 'history' && Array.isArray(msg.data) && msg.data.length) {
            setCandles(msg.data); candleSeriesRef.current.setData(msg.data); updatePriceData(msg.data)
            chartRef.current?.timeScale().fitContent()
          } else if (msg.type === 'candle' && msg.data) {
            candleSeriesRef.current.update(msg.data); setCurrentPrice(msg.data.close)
            setCandles((prev) => {
              if (!prev.length) return [msg.data]
              const next = prev[prev.length - 1].time === msg.data.time ? [...prev.slice(0, -1), msg.data] : [...prev.slice(-299), msg.data]
              setPriceChange(((msg.data.close - next[0].close) / next[0].close) * 100)
              return next
            })
          }
        },
        () => setWsConnected(true),
        () => setWsConnected(false),
      )

      // WS AI News (si implémenté côté serveur)
      if (typeof connectAINewsWS === 'function') {
        wsAiRef.current = connectAINewsWS(symbol, (update) => {
          if (!cancelled && update.type === 'ai_update') {
            setNews(update.news)
            setAiSummary(update.global_summary)
          }
        })
      }

    } catch (e) {
      console.error("WS Init Error", e)
      setTimeout(() => setWsConnected(false), 0)
    }

    return () => {
      cancelled = true
      if (wsCandleRef.current) wsCandleRef.current.close()
      if (wsAiRef.current) wsAiRef.current.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe])

  useEffect(() => {
    if (candles.length) applyIndicators(candles)
  }, [activeIndicators, candles, applyIndicators])

  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return
    if (showTrades) setTradeMarkers(buildTradeMarkers(generateDemoTrades(candles)))
    else setTradeMarkers([])
  }, [showTrades, candles, setTradeMarkers])

  const toggleIndicator = (id) => setActiveIndicators(prev => ({ ...prev, [id]: !prev[id] }))

  // Search Symbol Effect
  useEffect(() => {
    const q = symbolSearch.trim()
    if (!q) { setSearchResults([]); setSearchLoading(false); return }
    let cancelled = false; setSearchLoading(true)
    const handle = setTimeout(async () => {
      try {
        const results = await searchSymbols(q, 25)
        if (!cancelled) setSearchResults(Array.isArray(results) ? results : [])
      } catch { if (!cancelled) setSearchResults([]) }
      finally { if (!cancelled) setSearchLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [symbolSearch])

  const isPositive = priceChange >= 0
  const hasSearchQuery = symbolSearch.trim().length > 0

  return (
    <div className="flex h-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* ── MAIN AREA (CHART) ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* ── Toolbar ── */}
        <div className="relative z-50 flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur shrink-0 flex-wrap">
          {/* Symbol picker */}
          <div className="relative">
            <button
              onClick={() => { setShowSymbolMenu(p => !p); setShowTfMenu(false) }}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
            >
              <BarChart2 size={14} className="text-violet-400" />
              {symbol}
              <ChevronDown size={13} className="text-zinc-400" />
            </button>
            {showSymbolMenu && (
              <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-[80] min-w-[360px] max-w-[420px] py-1">
                <div className="px-3 pt-2 pb-2 border-b border-zinc-800">
                  <input
                    type="text" value={symbolSearch} onChange={(e) => setSymbolSearch(e.target.value)}
                    placeholder="Rechercher une action..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500"
                  />
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                  {searchLoading ? <div className="px-4 py-2 text-xs text-zinc-500">Recherche…</div>
                  : !hasSearchQuery ? (
                    <>
                      <div className="px-4 py-2 text-[10px] text-zinc-500 uppercase tracking-wider">Top 10 mondial</div>
                      {TOP_WORLD_STOCKS.map((s) => (
                        <button key={s.symbol} onClick={() => { setSymbol(s.symbol); setShowSymbolMenu(false); setSymbolSearch('') }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors ${s.symbol === symbol ? 'text-violet-400 font-semibold' : 'text-zinc-300'}`}>
                          <span className="font-semibold">{s.symbol}</span><span className="ml-2 text-zinc-500 text-xs">{s.name}</span>
                        </button>
                      ))}
                    </>
                  ) : searchResults.length === 0 ? <div className="px-4 py-2 text-xs text-zinc-500">Aucun résultat</div>
                  : searchResults.map((s) => (
                    <button key={s.symbol} onClick={() => { setSymbol(s.symbol); setShowSymbolMenu(false); setSymbolSearch('') }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors text-zinc-300">
                      <span className="font-semibold">{s.symbol}</span><span className="ml-2 text-zinc-500 text-xs">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Price display */}
          {currentPrice && (
            <div className="flex items-center gap-2 ml-1">
              <span className="text-lg font-bold font-mono tracking-tight">
                {currentPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: currentPrice < 10 ? 5 : 2 })}
              </span>
              <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {Math.abs(priceChange).toFixed(2)}%
              </span>
            </div>
          )}

          <div className="flex-1" />

          {/* Timeframe */}
          <div className="relative">
            <button onClick={() => { setShowTfMenu(p => !p); setShowSymbolMenu(false) }}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors">
              <Activity size={13} className="text-cyan-400" /> {timeframe} <ChevronDown size={12} className="text-zinc-400" />
            </button>
            {showTfMenu && (
              <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-[80] py-1">
                {TIMEFRAMES.map(tf => (
                  <button key={tf} onClick={() => { setTimeframe(tf); setShowTfMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors ${tf === timeframe ? 'text-cyan-400 font-semibold' : 'text-zinc-300'}`}>
                    {tf}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Indicators */}
          <div className="flex items-center gap-1">
            {INDICATORS.map(ind => (
              <button key={ind.id} onClick={() => toggleIndicator(ind.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${activeIndicators[ind.id] ? 'border-transparent text-zinc-900' : 'border-zinc-700 text-zinc-400 bg-zinc-900 hover:bg-zinc-800'}`}
                style={activeIndicators[ind.id] ? { backgroundColor: ind.color, borderColor: ind.color } : {}}>
                {ind.label}
              </button>
            ))}
          </div>

          <button onClick={() => setShowTrades(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${showTrades ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'border-zinc-700 text-zinc-500 bg-zinc-900 hover:bg-zinc-800'}`}>
            <Layers size={12} /> Trades
          </button>

          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${wsConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <Radio size={11} className={wsConnected ? 'animate-pulse' : ''} /> {wsConnected ? 'Live' : 'Offline'}
          </div>
        </div>

        {/* ── Chart Container ── */}
        <div ref={chartContainerRef} className="relative z-0 flex-1 min-h-[400px]" />
      </div>

      {/* ── SIDEBAR : AI & NEWS ── */}
      <div className="w-80 flex flex-col border-l border-zinc-800 bg-zinc-950 shrink-0">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/50">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
            <Newspaper size={16} className="text-violet-400" />
            Actualités & IA
          </h2>
          <button onClick={() => refreshNews(symbol)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 transition-colors" title="Rafraîchir les news">
            <RefreshCw size={14} className={newsLoading ? 'animate-spin text-violet-400' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Card IA Globale */}
          <AISummaryCard summary={aiSummary} loading={summaryLoading} />

          {/* Liste des news */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 ml-1">Flux en temps réel</h3>
            {newsLoading && !news.length ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-zinc-900 rounded-lg animate-pulse border border-zinc-800/50" />
                ))}
              </div>
            ) : news.length === 0 ? (
              <div className="text-center text-xs text-zinc-500 py-8">Aucune actualité récente.</div>
            ) : (
              news.map((item, idx) => <NewsItem key={item.id || idx} item={item} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}