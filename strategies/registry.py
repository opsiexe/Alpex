from dataclasses import dataclass, field
from typing import Any

from config import MA_LONG, MA_SHORT, SYMBOL


@dataclass(frozen=True)
class StrategyDefinition:
    id: str
    name: str
    type: str
    default_symbols: list[str]
    default_parameters: dict[str, Any]
    tags: list[str] = field(default_factory=list)
    ai: bool = False


def _default_symbol() -> str:
    symbol = (SYMBOL or "AAPL").strip().upper()
    return symbol or "AAPL"


DEFAULT_STRATEGIES: list[StrategyDefinition] = [
    StrategyDefinition(
        id="ma-crossover",
        name="MA Crossover",
        type="ma_crossover",
        default_symbols=[_default_symbol()],
        default_parameters={
            "short_window": MA_SHORT,
            "long_window": MA_LONG,
            "risk_pct": 0.02,
            "stop_loss_pct": 0.02,
            "take_profit_pct": 0.05,
            "max_positions": 3,
        },
        tags=["trend", "ma"],
    ),
    StrategyDefinition(
        id="gemini-ai",
        name="Gemini AI",
        type="gemini",
        default_symbols=[_default_symbol()],
        default_parameters={
            "short_window": MA_SHORT,
            "long_window": MA_LONG,
            "rsi_window": 14,
            "rsi_overbought": 70,
            "rsi_oversold": 30,
            "news_limit": 6,
            "risk_pct": 0.02,
            "stop_loss_pct": 0.02,
            "take_profit_pct": 0.05,
            "max_positions": 3,
        },
        tags=["ia", "news"],
        ai=True,
    ),
]


DEFINITIONS_BY_ID = {definition.id: definition for definition in DEFAULT_STRATEGIES}
