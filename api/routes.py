import asyncio
import csv
import io
import re
from typing import Any
import xml.etree.ElementTree as ET
import pandas as pd
import requests
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from alpaca.common.enums import Sort
from alpaca.trading.enums import QueryOrderStatus
from alpaca.trading.requests import GetOrdersRequest
from bot.broker import client, get_account, get_position
from bot.logger import log_buffer
from api.bot_manager import bot_manager
from config import MA_SHORT, MA_LONG, SYMBOL
from api.ia import get_complete_trading_analysis
router = APIRouter()

_TF_CONFIG = {
    "1m": {"interval": "1m", "period": "7d"},
    "5m": {"interval": "5m", "period": "60d"},
    "15m": {"interval": "15m", "period": "60d"},
    "1h": {"interval": "60m", "period": "730d"},
    "4h": {"interval": "60m", "period": "730d", "resample": "4h"},
    "1d": {"interval": "1d", "period": "10y"},
    "1w": {"interval": "1wk", "period": "max"},
    "1M": {"interval": "1mo", "period": "max"},
    "3M": {"interval": "3mo", "period": "max"},
}
_YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search"
_YAHOO_RSS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline"
_POSITIVE_NEWS_WORDS = {"beat", "surge", "growth", "record", "upgrade", "strong", "rally", "gain", "profit", "outperform"}
_NEGATIVE_NEWS_WORDS = {"miss", "drop", "fall", "downgrade", "weak", "lawsuit", "risk", "decline", "loss", "cut"}


def fetch_candles(symbol: str, tf: str, limit: int = 300) -> list[dict[str, Any]]:
    cfg = _TF_CONFIG.get(tf)
    if cfg is None:
        raise ValueError(f"timeframe invalide: {tf}")

    ticker = yf.Ticker(symbol.upper())
    df = ticker.history(
        period=cfg["period"],
        interval=cfg["interval"],
        auto_adjust=False,
        actions=False,
        prepost=False,
    )

    if df.empty:
        raise ValueError(f"Aucune donnée trouvée pour {symbol}")

    if isinstance(df.index, pd.DatetimeIndex) and df.index.tz is not None:
        df.index = df.index.tz_convert(None)

    resample_rule = cfg.get("resample")
    if resample_rule:
        df = df.resample(resample_rule).agg(
            {
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
            }
        ).dropna()

    if df.empty:
        raise ValueError(f"Aucune donnée trouvée pour {symbol} ({tf})")

    candles: list[dict[str, Any]] = []
    for ts, row in df.tail(limit).iterrows():
        candles.append(
            {
                "time": int(pd.Timestamp(ts).timestamp()),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row.get("Volume", 0.0)),
            }
        )

    return candles


def search_symbols(query: str, limit: int = 20) -> list[dict[str, str]]:
    q = query.strip()
    if len(q) < 1:
        return []

    response = requests.get(
        _YAHOO_SEARCH_URL,
        params={"q": q, "quotes_count": max(1, min(limit, 50)), "news_count": 0},
        headers={"User-Agent": "alpex/1.0"},
        timeout=8,
    )
    response.raise_for_status()
    payload = response.json()
    quotes = payload.get("quotes", [])

    results: list[dict[str, str]] = []
    for quote in quotes:
        quote_type = str(quote.get("quoteType", "")).upper()
        symbol = str(quote.get("symbol", "")).strip().upper()
        if quote_type != "EQUITY" or not symbol:
            continue
        results.append(
            {
                "symbol": symbol,
                "name": str(quote.get("shortname") or quote.get("longname") or symbol).strip(),
                "exchange": str(quote.get("exchDisp") or quote.get("exchange") or "").strip(),
                "type": quote_type,
            }
        )

    dedup: dict[str, dict[str, str]] = {}
    for item in results:
        dedup[item["symbol"]] = item
    return list(dedup.values())[:limit]


def _score_news_sentiment(title: str) -> float:
    words = set(re.findall(r"[a-z]+", title.lower()))
    pos = len(words & _POSITIVE_NEWS_WORDS)
    neg = len(words & _NEGATIVE_NEWS_WORDS)
    if pos == 0 and neg == 0:
        return 0.0
    score = (pos - neg) / max(pos + neg, 1)
    return max(-1.0, min(1.0, float(score)))


def fetch_news(symbol: str, limit: int = 20) -> list[dict[str, Any]]:
    ticker = yf.Ticker(symbol.upper())
    raw_items = ticker.news or []
    news_items: list[dict[str, Any]] = []

    if isinstance(raw_items, list):
        for item in raw_items[:limit]:
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            news_items.append(
                {
                    "title": title,
                    "url": str(item.get("link") or "#").strip() or "#",
                    "source": str(item.get("publisher") or "Yahoo Finance").strip(),
                    "timestamp": int(item.get("providerPublishTime") or pd.Timestamp.utcnow().timestamp()) * 1000,
                    "sentiment": _score_news_sentiment(title),
                }
            )

    # Fallback 1: Yahoo Search API (news_count)
    if not news_items:
        try:
            response = requests.get(
                _YAHOO_SEARCH_URL,
                params={"q": symbol.upper(), "quotes_count": 0, "news_count": max(1, min(limit, 50))},
                headers={"User-Agent": "alpex/1.0"},
                timeout=8,
            )
            response.raise_for_status()
            payload = response.json()
            for item in payload.get("news", [])[:limit]:
                title = str(item.get("title") or "").strip()
                if not title:
                    continue
                news_items.append(
                    {
                        "title": title,
                        "url": str(item.get("link") or "#").strip() or "#",
                        "source": str(item.get("publisher") or "Yahoo Finance").strip(),
                        "timestamp": int(item.get("providerPublishTime") or pd.Timestamp.utcnow().timestamp()) * 1000,
                        "sentiment": _score_news_sentiment(title),
                    }
                )
        except Exception:
            pass

    # Fallback 2: Yahoo RSS
    if not news_items:
        try:
            response = requests.get(
                _YAHOO_RSS_URL,
                params={"s": symbol.upper(), "region": "US", "lang": "en-US"},
                headers={"User-Agent": "alpex/1.0"},
                timeout=8,
            )
            response.raise_for_status()
            root = ET.fromstring(response.text)
            items = root.findall(".//item")
            for item in items[:limit]:
                title = (item.findtext("title") or "").strip()
                if not title:
                    continue
                link = (item.findtext("link") or "#").strip() or "#"
                pub_date = item.findtext("pubDate")
                timestamp = pd.Timestamp.utcnow().timestamp()
                if pub_date:
                    try:
                        timestamp = pd.to_datetime(pub_date, utc=True).timestamp()
                    except Exception:
                        pass
                news_items.append(
                    {
                        "title": title,
                        "url": link,
                        "source": "Yahoo Finance",
                        "timestamp": int(timestamp * 1000),
                        "sentiment": _score_news_sentiment(title),
                    }
                )
        except Exception:
            pass

    dedup: dict[str, dict[str, Any]] = {}
    for item in news_items:
        dedup[item["title"]] = item
    return list(dedup.values())[:limit]

def summarize_news(news: list[dict[str, Any]]) -> dict[str, Any]:
    if not news:
        return {"summary": "Aucune actualité récente trouvée.", "sentiment": 0.0}


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _build_live_strategies() -> list[dict[str, Any]]:
    account = get_account()
    equity = _to_float(account.get("equity"), 0.0)
    pnl = _to_float(account.get("pnl"), 0.0)
    base_equity = max(equity - pnl, 1.0)
    performance = (pnl / base_equity) * 100.0
    state = "active" if bot_manager.running else "paused"

    return [
        {
            "id": "ma-crossover",
            "name": f"MA Crossover {MA_SHORT}/{MA_LONG}",
            "symbol": SYMBOL,
            "performance": performance,
            "state": state,
            "latency_ms": None,
        }
    ]


def _build_realtime_alerts(limit: int = 20) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    for entry in reversed(list(log_buffer)):
        level_raw = str(entry.get("level", "")).upper()
        if level_raw not in {"WARNING", "WARN", "ERROR", "CRITICAL"}:
            continue
        level = "critical" if level_raw in {"ERROR", "CRITICAL"} else "warning"
        time = str(entry.get("time") or "—")
        text = str(entry.get("message") or "")
        if not text:
            continue
        alerts.append(
            {
                "id": f"alert-{time}-{level_raw}-{len(alerts)}",
                "level": level,
                "time": time,
                "text": text,
            }
        )
        if len(alerts) >= limit:
            break
    return alerts


def _build_ai_summary(limit: int = 10, symbol: str | None = None) -> dict[str, Any]:
    target_symbol = symbol or SYMBOL
    try:
        news_items = fetch_news(target_symbol, limit)
    except Exception:
        news_items = []

    if not news_items:
        return {"headline": "Aucun résumé IA disponible.", "bullets": [], "confidence": None}

    try:
        ai_data = get_complete_trading_analysis(news_items)
    except Exception:
        ai_data = {}

    headline = str(ai_data.get("global_summary") or "Résumé IA indisponible.")
    bullets = [
        str(item.get("title") or "").strip()
        for item in news_items[:3]
        if str(item.get("title") or "").strip()
    ]

    scores: list[float] = []
    for item in ai_data.get("news_analysis", []) or []:
        score = _to_float(item.get("score"), None)
        if score is not None:
            scores.append(score)

    confidence = int(round(sum(scores) / len(scores))) if scores else None

    return {
        "headline": headline,
        "bullets": bullets,
        "confidence": confidence,
    }


# --- Compte ---
@router.get("/account")
async def account():
    return get_account()

@router.get("/positions")
async def positions():
    return [{"symbol": p.symbol, "qty": p.qty,
             "pnl": float(p.unrealized_pl)} for p in get_position()]

# --- Bot ---
@router.post("/bot/start")
async def bot_start(): return bot_manager.start()

@router.post("/bot/stop")
async def bot_stop(): return bot_manager.stop()

@router.get("/bot/status")
async def bot_status(): return bot_manager.status()

# --- Config stratégie ---
@router.get("/config")
async def get_config():
    return {"symbol": SYMBOL, "ma_short": MA_SHORT, "ma_long": MA_LONG}

# --- Logs ---
@router.get("/logs")
async def get_logs(limit: int = 100):
    return list(log_buffer)[-limit:]


@router.get("/dashboard/strategies")
async def get_dashboard_strategies():
    return _build_live_strategies()


@router.get("/dashboard/alerts")
async def get_dashboard_alerts(limit: int = Query(20, ge=1, le=200)):
    return _build_realtime_alerts(limit)


@router.get("/dashboard/ai-summary")
async def get_dashboard_ai_summary(limit: int = Query(10, ge=1, le=50)):
    return await asyncio.to_thread(_build_ai_summary, limit)

@router.get("/trades/history")
async def get_trades_history(
    limit: int = Query(200, ge=1, le=500),
    start: str | None = Query(None),
    end: str | None = Query(None),
    symbol: str | None = Query(None),
    strategy: str | None = Query(None),
    side: str | None = Query(None),
    result: str | None = Query(None),
):
    try:
        start_dt = _parse_datetime_filter(start, "start")
        end_dt = _parse_datetime_filter(end, "end")
        if start_dt and end_dt and start_dt > end_dt:
            raise HTTPException(status_code=400, detail="Paramètres invalides: start doit être antérieur à end")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        trades = await asyncio.to_thread(_fetch_closed_trades, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur récupération historique trades: {exc}") from exc

    filtered = _apply_trades_filters(trades, start_dt, end_dt, symbol, strategy, side, result)
    return {
        "items": filtered,
        "total": len(filtered),
        "strategies": _extract_strategies(trades),
    }


@router.get("/trades/history/export")
async def export_trades_history(
    limit: int = Query(500, ge=1, le=500),
    start: str | None = Query(None),
    end: str | None = Query(None),
    symbol: str | None = Query(None),
    strategy: str | None = Query(None),
    side: str | None = Query(None),
    result: str | None = Query(None),
):
    try:
        start_dt = _parse_datetime_filter(start, "start")
        end_dt = _parse_datetime_filter(end, "end")
        if start_dt and end_dt and start_dt > end_dt:
            raise HTTPException(status_code=400, detail="Paramètres invalides: start doit être antérieur à end")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        trades = await asyncio.to_thread(_fetch_closed_trades, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur export historique trades: {exc}") from exc

    filtered = _apply_trades_filters(trades, start_dt, end_dt, symbol, strategy, side, result)
    csv_payload = _build_history_csv(filtered)

    return Response(
        content=csv_payload,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=trade-history.csv"},
    )


@router.get("/trades/history/{trade_id}")
async def get_trade_history_detail(trade_id: str):
    try:
        trades = await asyncio.to_thread(_fetch_closed_trades, 500)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur récupération détail trade: {exc}") from exc

    trade = next((item for item in trades if item["id"] == trade_id), None)
    if trade is None:
        raise HTTPException(status_code=404, detail="Trade introuvable")

    detail = await asyncio.to_thread(_enrich_trade_detail, trade)
    return detail


@router.get("/candles")
async def get_candles(
    symbol: str = Query(..., min_length=1),
    tf: str = Query("1h"),
    limit: int = Query(300, ge=10, le=2000),
):
    try:
        return await asyncio.to_thread(fetch_candles, symbol, tf, limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur fournisseur marché: {exc}") from exc


@router.get("/symbols/search")
async def get_symbols_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
):
    try:
        return await asyncio.to_thread(search_symbols, q, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur recherche symboles: {exc}") from exc


@router.get("/news")
async def get_news(
    symbol: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
):
    try:
        return await asyncio.to_thread(fetch_news, symbol, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erreur news marché: {exc}") from exc


@router.get("/news/analyze")
async def get_analyzed_news(
        symbol: str = Query(..., min_length=1),
        limit: int = Query(10, ge=1, le=20)
):
    try:
        # 1. Récupération des news (bloquant -> to_thread)
        # On utilise ta fonction fetch_news existante
        news_items = await asyncio.to_thread(fetch_news, symbol, limit)

        if not news_items:
            return {
                "symbol": symbol,
                "global_summary": "Aucune actualité trouvée pour ce symbole.",
                "news": []
            }

        # 2. Analyse IA (bloquant -> to_thread)
        # On envoie la liste des news à Gemini
        ai_data = await asyncio.to_thread(get_complete_trading_analysis, news_items)

        # 3. Fusion des données
        # On ajoute le sentiment et le score de l'IA à chaque news correspondante
        if ai_data and "news_analysis" in ai_data:
            analysis_map = {item["id"]: item for item in ai_data["news_analysis"]}

            for idx, news in enumerate(news_items):
                analysis = analysis_map.get(idx)
                if analysis:
                    news["ai_sentiment"] = analysis.get("sentiment", "Neutral")
                    news["ai_score"] = analysis.get("score", 50)
                else:
                    news["ai_sentiment"] = "Neutral"
                    news["ai_score"] = 50

        # 4. Réponse finale structurée
        return {
            "symbol": symbol,
            "global_summary": ai_data.get("global_summary") if ai_data else "Analyse indisponible",
            "news": news_items
        }

    except Exception as e:
        # Log l'erreur pour le debug interne
        print(f"Erreur Route News: {e}")
        raise HTTPException(status_code=500, detail=str(e))