from data.fetcher import load_local
from backtest.runner import run_backtest
from backtest.walk_forward import walk_forward
from backtest.export import export_results
from loguru import logger

SYMBOL = "NVDA"
PARAMS = {"short_window": 20, "long_window": 50}
INITIAL_CASH = 10_000

if __name__ == "__main__":
    df = load_local(SYMBOL)
    logger.info(f"Données chargées : {len(df)} jours")

    # 1. Backtest complet (avec graphique)
    logger.info("=== Backtest complet ===")
    metrics = run_backtest(df, initial_cash=INITIAL_CASH, plot=True, **PARAMS)
    for k, v in metrics.items():
        if k != "trades":
            logger.info(f" {k:20s}: {v}")

    # 2. Walk-forward (anti-overfitting)
    logger.info("=== Walk-forward validation ===")
    wf = walk_forward(df, train_ratio=0.7, initial_cash=INITIAL_CASH, **PARAMS)
    logger.info(f"Dégradation train→test : {wf['degradation_pct']}%")

    # 3. Export JSON pour le dashboard
    path = export_results(metrics, SYMBOL, PARAMS)
    logger.success(f"Résultats exportés → {path}")