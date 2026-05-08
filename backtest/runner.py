import backtrader as bt
import pandas as pd
from backtest.strategy import MACrossover
from backtest.metrics import compute_metrics


def run_backtest(
    df: pd.DataFrame,
    initial_cash: float = 10_000,
    short_window: int = 20,
    long_window: int = 50,
    commission: float = 0.001, # 0.1% par ordre
    plot: bool = False,
) -> dict:
    cerebro = bt.Cerebro()

    # Données
    data = bt.feeds.PandasData(dataname=df)
    cerebro.adddata(data)

    # Stratégie + paramètres
    cerebro.addstrategy(
        MACrossover,
        short_window=short_window,
        long_window=long_window,
    )

    # Capital + commission
    cerebro.broker.setcash(initial_cash)
    cerebro.broker.setcommission(commission=commission)

    # Analyzeurs
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name="sharpe")

    result = cerebro.run()

    if plot:
        cerebro.plot(style="candlestick", volume=False)

    return compute_metrics(result, initial_cash)