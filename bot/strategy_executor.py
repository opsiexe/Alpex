import uuid
from typing import Any

import yfinance as yf
from loguru import logger

from bot.broker import get_account, get_position, place_market_order
from bot.risk import RiskParams, can_open_position, compute_position_size, compute_stop_take
from data.strategy_store import StrategyRecord, StrategyStore
from data.updater import update_symbol
from strategies.gemini_strategy import GeminiDecision, get_latest_signal as get_gemini_signal
from strategies.ma_crossover import get_latest_signal as get_ma_signal


def _parse_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _build_risk_params(params: dict[str, Any]) -> RiskParams:
    return RiskParams(
        risk_pct=_parse_float(params.get("risk_pct"), 0.02),
        stop_loss_pct=_parse_float(params.get("stop_loss_pct"), 0.02),
        take_profit_pct=_parse_float(params.get("take_profit_pct"), 0.05),
        max_positions=_parse_int(params.get("max_positions"), 3),
    )


def _fetch_news(symbol: str, limit: int = 6) -> list[dict[str, Any]]:
    try:
        ticker = yf.Ticker(symbol.upper())
        raw_items = ticker.news or []
        news_items: list[dict[str, Any]] = []
        for item in raw_items[:limit]:
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            news_items.append(
                {
                    "title": title,
                    "url": str(item.get("link") or "#").strip() or "#",
                    "source": str(item.get("publisher") or "Yahoo Finance").strip(),
                }
            )
        return news_items
    except Exception as exc:
        logger.warning("Erreur récupération news {}: {}", symbol, exc)
        return []


def _build_client_order_id(strategy_id: str) -> str:
    return f"strategy:{strategy_id}:{uuid.uuid4().hex[:8]}"


def _handle_ma_strategy(symbol: str, params: dict[str, Any]) -> tuple[str, str, float, float, float, list[dict[str, Any]]]:
    short_window = _parse_int(params.get("short_window"), 20)
    long_window = _parse_int(params.get("long_window"), 50)
    df = update_symbol(symbol)
    result = get_ma_signal(df, short_window, long_window)
    technical_signal = result.reason
    logger.info(
        "Signal MA {}: {} | price=${:.2f} MA{}=${:.2f} MA{}=${:.2f}",
        symbol,
        result.signal.upper(),
        result.price,
        short_window,
        result.ma_short,
        long_window,
        result.ma_long,
    )
    return result.signal, technical_signal, result.price, result.ma_short, result.ma_long, []


def _handle_gemini_strategy(symbol: str, params: dict[str, Any]) -> GeminiDecision:
    short_window = _parse_int(params.get("short_window"), 20)
    long_window = _parse_int(params.get("long_window"), 50)
    rsi_window = _parse_int(params.get("rsi_window"), 14)
    news_limit = _parse_int(params.get("news_limit"), 6)
    news = _fetch_news(symbol, news_limit)
    df = update_symbol(symbol)
    return get_gemini_signal(
        df,
        symbol=symbol,
        short_window=short_window,
        long_window=long_window,
        rsi_window=rsi_window,
        news=news,
    )


def execute_strategy(strategy: StrategyRecord, store: StrategyStore) -> None:
    params = strategy.parameters
    risk_params = _build_risk_params(params)

    for symbol in strategy.symbols:
        symbol = symbol.upper()
        try:
            if strategy.type == "ma_crossover":
                signal, technical_signal, price, _, _, news = _handle_ma_strategy(symbol, params)
                ai_explanation = None
            elif strategy.type == "gemini":
                decision = _handle_gemini_strategy(symbol, params)
                signal = decision.signal
                price = decision.price
                technical_signal = (
                    f"MA courte={decision.ma_short:.2f} | MA longue={decision.ma_long:.2f} | RSI={decision.rsi:.1f}"
                )
                ai_explanation = decision.reason
                news = decision.news
                logger.info(
                    "Signal Gemini {}: {} | reason={}",
                    symbol,
                    decision.signal.upper(),
                    decision.reason,
                )
            else:
                raise ValueError(f"Type de stratégie inconnu: {strategy.type}")

            if signal == "hold":
                continue

            account = get_account()
            positions = get_position()
            if not can_open_position(len(positions), risk_params):
                continue

            qty = compute_position_size(account["cash"], price, risk_params)
            stop, target = compute_stop_take(price, signal, risk_params)
            logger.info(
                "Strategy {} | {} qty={} stop=${} target=${}",
                strategy.id,
                symbol,
                qty,
                stop,
                target,
            )

            order = place_market_order(
                symbol,
                qty=qty,
                side=signal,
                client_order_id=_build_client_order_id(strategy.id),
            )
            logger.success("Ordre {} exécuté — id: {}", signal.upper(), order.id)
            store.record_trade_metadata(
                order_id=str(order.id),
                strategy_id=strategy.id,
                symbol=symbol,
                signal=signal,
                technical_signal=technical_signal,
                ai_explanation=ai_explanation,
                news=news[0] if news else None,
            )
        except Exception as exc:
            logger.error("Erreur stratégie {} ({}): {}", strategy.id, symbol, exc)
