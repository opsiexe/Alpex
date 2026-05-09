import asyncio
import re
from typing import Any
import xml.etree.ElementTree as ET

import pandas as pd
import requests
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from bot.broker import get_account, get_position
from bot.logger import log_buffer
from api.bot_manager import bot_manager
from config import MA_SHORT, MA_LONG, SYMBOL

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
