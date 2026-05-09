import asyncio
from typing import Any

import pandas as pd
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
