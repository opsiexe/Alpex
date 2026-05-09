import json
import os
import re
from dataclasses import dataclass
from typing import Any, Literal

import pandas as pd
from dotenv import load_dotenv
from loguru import logger

try:
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover - fallback if dependency missing
    genai = None
    types = None

load_dotenv()

Signal = Literal["buy", "sell", "hold"]

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
_API_KEY = os.getenv("GOOGLE_API_KEY")
_CLIENT = genai.Client(api_key=_API_KEY) if genai and _API_KEY else None


@dataclass
class GeminiDecision:
    signal: Signal
    reason: str
    price: float
    ma_short: float
    ma_long: float
    rsi: float
    news: list[dict[str, Any]]


def _compute_rsi(series: pd.Series, window: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=window, min_periods=window).mean()
    avg_loss = loss.rolling(window=window, min_periods=window).mean()
    rs = avg_gain / avg_loss.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def _build_context(
    df: pd.DataFrame,
    symbol: str,
    short_window: int,
    long_window: int,
    rsi_window: int,
    news: list[dict[str, Any]],
    rows: int = 30,
) -> dict[str, Any]:
    sample = df.tail(rows).reset_index()
    ohlcv = []
    for _, row in sample.iterrows():
        ts = row.get("Date")
        if isinstance(ts, pd.Timestamp):
            ts = ts.isoformat()
        ohlcv.append(
            {
                "time": ts,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row.get("Volume", 0.0)),
                "ma_short": float(row["ma_short"]),
                "ma_long": float(row["ma_long"]),
                "rsi": float(row["rsi"]),
            }
        )
    return {
        "symbol": symbol,
        "indicators": {
            "short_window": short_window,
            "long_window": long_window,
            "rsi_window": rsi_window,
        },
        "ohlcv_recent": ohlcv,
        "news_titles": [item.get("title") for item in news if item.get("title")],
    }


def _parse_response(raw_text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```json\s*|```$", "", raw_text.strip(), flags=re.MULTILINE).strip()
    return json.loads(cleaned)


def get_latest_signal(
    df: pd.DataFrame,
    *,
    symbol: str,
    short_window: int = 20,
    long_window: int = 50,
    rsi_window: int = 14,
    news: list[dict[str, Any]] | None = None,
) -> GeminiDecision:
    news = news or []
    if _CLIENT is None:
        logger.warning("Clé Gemini absente ou SDK indisponible, passage en HOLD.")
        return GeminiDecision("hold", "Gemini indisponible (clé API manquante).", 0.0, 0.0, 0.0, 50.0, news)

    df = df.copy()
    df["ma_short"] = df["Close"].rolling(short_window).mean()
    df["ma_long"] = df["Close"].rolling(long_window).mean()
    df["rsi"] = _compute_rsi(df["Close"], rsi_window)
    df = df.dropna()

    if df.empty:
        return GeminiDecision("hold", "Données insuffisantes pour calculer les indicateurs.", 0.0, 0.0, 0.0, 50.0, news)

    last = df.iloc[-1]
    price = float(last["Close"])
    ma_short = float(last["ma_short"])
    ma_long = float(last["ma_long"])
    rsi = float(last["rsi"])

    context = _build_context(df, symbol, short_window, long_window, rsi_window, news)
    prompt = f"""
    Tu es un assistant de trading algorithmique. Analyse le contexte JSON suivant et décide d'une action.
    Retourne uniquement un JSON strict de la forme :
    {{
      "signal": "buy" | "sell" | "hold",
      "reason": "explication concise en français",
      "confidence": 0-100
    }}
    Contexte:
    {json.dumps(context, ensure_ascii=False)}
    """.strip()

    try:
        response = _CLIENT.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        payload = _parse_response(response.text)
        signal = str(payload.get("signal", "hold")).lower()
        if signal not in {"buy", "sell", "hold"}:
            signal = "hold"
        reason = str(payload.get("reason") or "Décision Gemini indisponible.").strip()
        return GeminiDecision(signal, reason, price, ma_short, ma_long, rsi, news)
    except Exception as exc:
        logger.error("Erreur Gemini: {}", exc)
        return GeminiDecision("hold", "Erreur Gemini lors de l'analyse.", price, ma_short, ma_long, rsi, news)
