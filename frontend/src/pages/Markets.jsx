import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CrosshairMode, LineStyle, CandlestickSeries, LineSeries } from 'lightweight-charts'
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, RefreshCw,
  Activity, BarChart2, Layers, Radio, Bot, Newspaper,
  ArrowUpRight, ArrowDownRight, AlertCircle
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE = BASE.replace(/^http/, 'ws')

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT', 'XRP/USDT']
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d']
const MACD_SIGNAL_PERIOD = 9

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

/* ── Sentiment badge ─────────────────────────────── */
function SentimentBadge({ score }) {
  if (score >= 0.2)
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
        <TrendingUp size={10} /> Positif
      </span>
    )
  if (score <= -0.2)
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
        <TrendingDown size={10} /> Négatif
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-zinc-400 bg-zinc-700/50 px-2 py-0.5 rounded-full">
      <Minus size={10} /> Neutre
    </span>
  )
}

/* ── Score bar ───────────────────────────────────── */
function ScoreBar({ score }) {
  const pct = Math.round(Math.abs(score) * 100)
  const color = score >= 0.2 ? 'bg-emerald-500' : score <= -0.2 ? 'bg-red-500' : 'bg-zinc-500'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-500">{pct}%</span>
    </div>
  )
}

/* ── News item ───────────────────────────────────── */
function formatAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return 'À l\'instant'
  if (diff < 60) return `${diff}min`
  return `${Math.floor(diff / 60)}h`
}

function NewsItem({ item }) {
  return (
    <div className="border-b border-zinc-800/70 pb-3 mb-3 last:border-0 last:mb-0">
      <div className="flex items-start justify-between gap-2 mb-1">
        <a
          href={item.url || '#'}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-zinc-200 hover:text-white leading-snug line-clamp-2 flex-1 transition-colors"
        >
          {item.title}
        </a>
        <span className="text-[10px] text-zinc-500 whitespace-nowrap">{formatAgo(item.timestamp)}</span>
      </div>
      <div className="flex items-center justify-between">
        <SentimentBadge score={item.sentiment} />
        <span className="text-[10px] text-zinc-600">{item.source}</span>
      </div>
      <ScoreBar score={item.sentiment} />
    </div>
  )
}

/* ── AI summary card ─────────────────────────────── */
function AISummaryCard({ summary, loading }) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Bot size={13} className="text-violet-400" />
        <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Résumé IA</span>
        {loading && <RefreshCw size={10} className="text-zinc-500 animate-spin ml-auto" />}
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-full" />
          <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-4/5" />
          <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-3/5" />
        </div>
      ) : (
        <p className="text-xs text-zinc-300 leading-relaxed">{summary || 'Aucun résumé disponible.'}</p>
      )}
    </div>
  )
}

/* ── Trade marker overlay data ───────────────────── */
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

/* ── Generate demo candles ───────────────────────── */
function generateDemoCandles(symbol, tf) {
  const tfMs = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }
  const step = tfMs[tf] || 3600
  const basePrice = { 'BTC/USDT': 67000, 'ETH/USDT': 3500, 'SOL/USDT': 175, 'BNB/USDT': 580, 'ADA/USDT': 0.45, 'XRP/USDT': 0.55 }[symbol] || 100
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

function generateDemoNews(symbol) {
  const base = symbol.split('/')[0]
  const items = [
    { title: `${base} franchit un niveau clé de résistance, les analystes anticipent une hausse`, sentiment: 0.72, source: 'CoinDesk', url: '#', timestamp: Date.now() - 420000 },
    { title: `La SEC examine de nouvelles réglementations pouvant affecter ${base}`, sentiment: -0.41, source: 'Reuters', url: '#', timestamp: Date.now() - 900000 },
    { title: `Les volumes d'échange de ${base} atteignent un sommet mensuel`, sentiment: 0.35, source: 'Bloomberg', url: '#', timestamp: Date.now() - 1800000 },
    { title: `Mise à jour du réseau ${base} prévue pour le prochain trimestre`, sentiment: 0.12, source: 'CryptoNews', url: '#', timestamp: Date.now() - 3600000 },
    { title: `Analyse technique : ${base} consolide avant un mouvement directionnel`, sentiment: -0.05, source: 'TradingView', url: '#', timestamp: Date.now() - 5400000 },
    { title: `Whale alert : transfert massif de ${base} vers un exchange centralisé`, sentiment: -0.55, source: 'Whale Alert', url: '#', timestamp: Date.now() - 7200000 },
  ]
  return items
}

function generateAISummary(symbol) {
  const base = symbol.split('/')[0]
  return `${base} montre une dynamique haussière modérée sur les sessions récentes. Le sentiment global des actualités est légèrement positif (score +0.18). Les volumes sont en hausse de 12% par rapport à la moyenne hebdomadaire. Attention au niveau de résistance à surveiller dans les prochaines heures.`
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
  const wsRef = useRef(null)

  const [symbol, setSymbol] = useState('BTC/USDT')
  const [timeframe, setTimeframe] = useState('1h')
  const [activeIndicators, setActiveIndicators] = useState({ ma: true, bb: false, rsi: false, macd: false })
  const [showSymbolMenu, setShowSymbolMenu] = useState(false)
  const [showTfMenu, setShowTfMenu] = useState(false)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [priceChange, setPriceChange] = useState(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [showTrades, setShowTrades] = useState(true)
  const [candles, setCandles] = useState([])

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

  /* ── Build / update indicator series ─────────── */
  const applyIndicators = useCallback((data) => {
    if (!chartRef.current || !candleSeriesRef.current) return

    // MA
    if (activeIndicators.ma) {
      if (!maSeriesRef.current) {
        maSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      }
      maSeriesRef.current.setData(computeMA(data))
    } else if (maSeriesRef.current) {
      chartRef.current.removeSeries(maSeriesRef.current)
      maSeriesRef.current = null
    }

    // Bollinger Bands
    if (activeIndicators.bb) {
      const { upper, lower } = computeBB(data)
      if (!bbUpperRef.current) {
        bbUpperRef.current = chartRef.current.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
        bbLowerRef.current = chartRef.current.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      }
      bbUpperRef.current.setData(upper)
      bbLowerRef.current.setData(lower)
    } else {
      if (bbUpperRef.current) { chartRef.current.removeSeries(bbUpperRef.current); bbUpperRef.current = null }
      if (bbLowerRef.current) { chartRef.current.removeSeries(bbLowerRef.current); bbLowerRef.current = null }
    }

    // RSI — separate pane
    if (activeIndicators.rsi) {
      if (!rsiSeriesRef.current) {
        rsiSeriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: '#06b6d4', lineWidth: 1, priceScaleId: 'rsi',
          priceLineVisible: false, lastValueVisible: true,
        })
        chartRef.current.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, borderVisible: false })
      }
      rsiSeriesRef.current.setData(computeRSI(data))
    } else if (rsiSeriesRef.current) {
      chartRef.current.removeSeries(rsiSeriesRef.current)
      rsiSeriesRef.current = null
    }

    // MACD — separate pane
    if (activeIndicators.macd) {
      const { macd, signal } = computeMACD(data)
      if (!macdSeriesRef.current) {
        macdSeriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: '#10b981', lineWidth: 1, priceScaleId: 'macd',
          priceLineVisible: false, lastValueVisible: true,
        })
        macdSignalRef.current = chartRef.current.addSeries(LineSeries, {
          color: '#f97316', lineWidth: 1, priceScaleId: 'macd',
          priceLineVisible: false, lastValueVisible: false,
        })
        chartRef.current.priceScale('macd').applyOptions({ scaleMargins: { top: 0.88, bottom: 0 }, borderVisible: false })
      }
      macdSeriesRef.current.setData(macd)
      macdSignalRef.current.setData(signal)
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
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
    })
    candleSeriesRef.current = cs

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current)
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight })
    })
    ro.observe(chartContainerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      maSeriesRef.current = null
      bbUpperRef.current = null
      bbLowerRef.current = null
      rsiSeriesRef.current = null
      macdSeriesRef.current = null
      macdSignalRef.current = null
    }
  }, [])

  /* ── Load candle data when symbol/timeframe changes ── */
  useEffect(() => {
    if (!candleSeriesRef.current) return

    // Reset indicators series on symbol/tf change
    ;[maSeriesRef, bbUpperRef, bbLowerRef, rsiSeriesRef, macdSeriesRef, macdSignalRef].forEach(r => {
      if (r.current && chartRef.current) { try { chartRef.current.removeSeries(r.current) } catch { /* series already removed */ } r.current = null }
    })

    const data = generateDemoCandles(symbol, timeframe)
    setCandles(data)
    candleSeriesRef.current.setData(data)

    setTimeout(() => {
      if (data.length) {
        setCurrentPrice(data[data.length - 1].close)
        const first = data[0].close
        const last = data[data.length - 1].close
        setPriceChange(((last - first) / first) * 100)
      }
    }, 0)

    // Trade overlays
    if (showTrades) {
      const trades = generateDemoTrades(data)
      candleSeriesRef.current.setMarkers(buildTradeMarkers(trades))
    }

    chartRef.current?.timeScale().fitContent()

    // Load news & summary
    setNewsLoading(true)
    setSummaryLoading(true)
    setTimeout(() => { setNews(generateDemoNews(symbol)); setNewsLoading(false) }, 800)
    setTimeout(() => { setAiSummary(generateAISummary(symbol)); setSummaryLoading(false) }, 1400)

    // WebSocket for live price
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    try {
      const ws = new WebSocket(`${WS_BASE}/ws/candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`)
      ws.onopen = () => setWsConnected(true)
      ws.onclose = () => setWsConnected(false)
      ws.onerror = () => setWsConnected(false)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'candle' && candleSeriesRef.current) {
            candleSeriesRef.current.update(msg.data)
            setCurrentPrice(msg.data.close)
          }
        } catch { /* invalid WS message */ }
      }
      wsRef.current = ws
    } catch {
      setTimeout(() => setWsConnected(false), 0)
    }

    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe])

  /* ── Apply indicators when toggles change ───── */
  useEffect(() => {
    if (candles.length) applyIndicators(candles)
  }, [activeIndicators, candles, applyIndicators])

  /* ── Toggle trade markers ────────────────────── */
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return
    if (showTrades) {
      candleSeriesRef.current.setMarkers(buildTradeMarkers(generateDemoTrades(candles)))
    } else {
      candleSeriesRef.current.setMarkers([])
    }
  }, [showTrades, candles])

  const toggleIndicator = (id) => setActiveIndicators(prev => ({ ...prev, [id]: !prev[id] }))

  const isPositive = priceChange >= 0

  return (
    <div className="flex h-full overflow-hidden bg-zinc-950 text-zinc-100">

      {/* ── MAIN AREA ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur shrink-0 flex-wrap">

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
              <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 min-w-[140px] py-1">
                {SYMBOLS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSymbol(s); setShowSymbolMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors ${s === symbol ? 'text-violet-400 font-semibold' : 'text-zinc-300'}`}
                  >{s}</button>
                ))}
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
            <button
              onClick={() => { setShowTfMenu(p => !p); setShowSymbolMenu(false) }}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              <Activity size={13} className="text-cyan-400" />
              {timeframe}
              <ChevronDown size={12} className="text-zinc-400" />
            </button>
            {showTfMenu && (
              <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf}
                    onClick={() => { setTimeframe(tf); setShowTfMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors ${tf === timeframe ? 'text-cyan-400 font-semibold' : 'text-zinc-300'}`}
                  >{tf}</button>
                ))}
              </div>
            )}
          </div>

          {/* Indicators */}
          <div className="flex items-center gap-1">
            {INDICATORS.map(ind => (
              <button
                key={ind.id}
                onClick={() => toggleIndicator(ind.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  activeIndicators[ind.id]
                    ? 'border-transparent text-zinc-900'
                    : 'border-zinc-700 text-zinc-400 bg-zinc-900 hover:bg-zinc-800'
                }`}
                style={activeIndicators[ind.id] ? { backgroundColor: ind.color, borderColor: ind.color } : {}}
              >{ind.label}</button>
            ))}
          </div>

          {/* Trade overlay toggle */}
          <button
            onClick={() => setShowTrades(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showTrades ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'border-zinc-700 text-zinc-500 bg-zinc-900 hover:bg-zinc-800'
            }`}
            title="Overlay trades"
          >
            <Layers size={12} />
            Trades
          </button>

          {/* WS status */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${wsConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <Radio size={11} className={wsConnected ? 'animate-pulse' : ''} />
            {wsConnected ? 'Live' : 'Offline'}
          </div>
        </div>

        {/* ── Chart ── */}
        <div
          ref={chartContainerRef}
          className="flex-1 w-full"
          style={{ minHeight: 0 }}
          onClick={() => { setShowSymbolMenu(false); setShowTfMenu(false) }}
        />
      </div>

      {/* ── RIGHT PANEL ── */}
      <aside className="w-80 shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Newspaper size={14} className="text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-200">Actualités & IA</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">{symbol}</span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">

          {/* AI Summary */}
          <AISummaryCard summary={aiSummary} loading={summaryLoading} />

          {/* Sentiment overview */}
          {!newsLoading && news.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 flex gap-1">
                {['positive', 'neutral', 'negative'].map((t) => {
                  const count = news.filter(n => t === 'positive' ? n.sentiment >= 0.2 : t === 'negative' ? n.sentiment <= -0.2 : (n.sentiment > -0.2 && n.sentiment < 0.2)).length
                  const color = t === 'positive' ? 'bg-emerald-500' : t === 'negative' ? 'bg-red-500' : 'bg-zinc-600'
                  const width = `${Math.round(count / news.length * 100)}%`
                  return <div key={t} className={`h-1 rounded-full ${color}`} style={{ width }} title={`${t}: ${count}`} />
                })}
              </div>
              <span className="text-[10px] text-zinc-500">{news.length} articles</span>
            </div>
          )}

          {/* News list */}
          {newsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-zinc-800 rounded animate-pulse w-full" />
                  <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-zinc-800 rounded animate-pulse w-1/3" />
                </div>
              ))}
            </div>
          ) : news.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2">
              <AlertCircle size={24} />
              <span className="text-sm">Aucune actualité disponible</span>
            </div>
          ) : (
            news.map((item, idx) => <NewsItem key={idx} item={item} />)
          )}
        </div>

        {/* Footer: refresh */}
        <div className="border-t border-zinc-800 px-4 py-2.5 shrink-0">
          <button
            onClick={() => {
              setNewsLoading(true)
              setSummaryLoading(true)
              setTimeout(() => { setNews(generateDemoNews(symbol)); setNewsLoading(false) }, 600)
              setTimeout(() => { setAiSummary(generateAISummary(symbol)); setSummaryLoading(false) }, 1000)
            }}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RefreshCw size={11} />
            Actualiser
          </button>
        </div>
      </aside>

      {/* Close dropdowns on outside click */}
      {(showSymbolMenu || showTfMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowSymbolMenu(false); setShowTfMenu(false) }} />
      )}
    </div>
  )
}
