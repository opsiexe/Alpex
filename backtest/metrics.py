import numpy as np
from typing import Any

def compute_metrics(result: Any, initial_cash: float) -> dict:
    strat = result[0]

    # Capital final
    final_value = strat.broker.getvalue()
    total_return = (final_value - initial_cash) / initial_cash * 100

    # Trades
    trades = strat.trades
    n_trades = len(trades)
    wins = [t for t in trades if t["pnl"] > 0]
    win_rate = len(wins) / n_trades * 100 if n_trades > 0 else 0

    # Sharpe ratio (approximation annualisée sur les PnL des trades)
    pnls = [t["pnl"] for t in trades]
    if len(pnls) > 1 and np.std(pnls) > 0:
        sharpe = (np.mean(pnls) / np.std(pnls)) * np.sqrt(252)
    else:
        sharpe = 0.0

    # Max drawdown via l'analyzeur Backtrader
    dd_analysis = strat.analyzers.drawdown.get_analysis()
    max_dd = dd_analysis.get("max", {}).get("drawdown", 0)

    return {
         "initial_cash": round(initial_cash, 2),
         "final_value": round(final_value, 2),
         "total_return": round(total_return, 2),
         "n_trades": n_trades,
         "win_rate": round(win_rate, 2),
         "sharpe": round(sharpe, 3),
         "max_drawdown": round(max_dd, 2),
         "trades": trades,
        }