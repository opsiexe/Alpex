import pandas as pd
from dataclasses import dataclass
from typing import Literal

Signal = Literal["buy", "sell", "hold"]

@dataclass
class StrategyResult:
    signal: Signal
    ma_short: float
    ma_long: float
    price: float
    reason: str

def compute_signals(
        df: pd.DataFrame,
        short_window: int = 20,
        long_window: int = 50,
) -> pd.DataFrame:
    # Calcul des moyennes mobiles simple
    df = df.copy()
    df["ma_short"] = df["Close"].rolling(short_window).mean()
    df["ma_long"] = df["Close"].rolling(long_window).mean()

    # Position : 1 quand ma_short > ma_long, 0 sinon
    df["position"] = (df["ma_short"] > df["ma_long"]).astype(int)

    # Signal = changement de position (croisement)
    # +1 = croisement haussier, -1 = baissier, 0 = neutre
    df["signal"] = df["position"].diff()
    return df.dropna()

def get_latest_signal(
    df: pd.DataFrame,
    short_window: int = 20,
    long_window: int = 50,
) -> StrategyResult:
    df = compute_signals(df, short_window, long_window)
    last = df.iloc[-1]

    price = float(last["Close"])
    ma_short = float(last["ma_short"])
    ma_long = float(last["ma_long"])
    sig = float(last["signal"])

    if sig == 1:
        return StrategyResult("buy", ma_short, ma_long, price, f"MA{short_window} croise MA{long_window} à la hausse")
    elif sig == -1:
        return StrategyResult("sell", ma_short, ma_long, price, f"MA{short_window} croise MA{long_window} à la baisse")
    else:
        return StrategyResult("hold", ma_short, ma_long, price, "Pas de croisement")