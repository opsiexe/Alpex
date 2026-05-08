import pandas as pd
from backtest.runner import run_backtest
from loguru import logger


def walk_forward(
    df: pd.DataFrame,
    train_ratio: float = 0.7, # 70% entraînement
    **kwargs,
) -> dict:
    # Découpage train / test
    split = int(len(df) * train_ratio)
    df_train = df.iloc[:split]
    df_test = df.iloc[split:]

    logger.info(f"Train : {df_train.index[0].date()} → {df_train.index[-1].date()} ({len(df_train)} jours)")
    logger.info(f"Test : {df_test.index[0].date()} → {df_test.index[-1].date()} ({len(df_test)} jours)")

    # Backtest sur chaque période
    metrics_train = run_backtest(df_train, **kwargs)
    metrics_test = run_backtest(df_test, **kwargs)

    # Ratio de dégradation : si test >> train → overfitting
    degradation = (
        (metrics_train["total_return"] - metrics_test["total_return"])
        / abs(metrics_train["total_return"] + 1e-9)
    ) * 100

    logger.info(f"Return train : {metrics_train['total_return']}%")
    logger.info(f"Return test : {metrics_test['total_return']}%")
    logger.info(f"Dégradation : {degradation:.1f}%")

    if degradation > 50:
        logger.warning("Dégradation > 50% — risque d'overfitting !")

    return {
        "train": metrics_train,
        "test": metrics_test,
        "degradation_pct": round(degradation, 1),
    }