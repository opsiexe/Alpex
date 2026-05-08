import yfinance as yf
import pandas as pd
import sqlite3
from pathlib import Path
from loguru import logger
from datetime import datetime

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "markets.db"

def fetch_ohlcv(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    # Télécharger les données de Yahoo Finance
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)

    if df.empty:
        raise ValueError(f"Aucune donnée n'a été trouvé pour {symbol}")

    # Nettoyage : on garde les colonnes utiles
    df = df[["Open", "High", "Low", "Close", "Volume"]]
    df.index = pd.to_datetime(df.index).tz_localize(None)
    df.index.name = "Date"

    logger.info(f"[{symbol}] {len(df)} bougie récupérées ({interval})")

    return df

def save_csv(df: pd.DataFrame, symbol: str) -> Path:
    # Sauvegarde en CSV horodaté
    path = DATA_DIR / f"{symbol.upper()}.csv"
    df.to_csv(path)
    logger.info(f"CSV sauvegardé -> {path}")
    return path

def save_sqlite(df: pd.DataFrame, symbol: str) -> None:
    # Stockage dans SQLite (upsert : pas de doublons)
    with sqlite3.connect(DB_PATH) as conn:
        df_reset = df.reset_index()
        df_reset["Symbol"] = symbol.upper()
        df.to_sql(
            name="ohlcv",
            con=conn,
            if_exists="replace", # "append" pour cumuler
            index=True,
        )
    logger.info(f"SQLite sauvegardé -> {DB_PATH} (table ohlcv)")

def load_local(symbol: str) -> pd.DataFrame:
    # On charge depuis le CSV local (pas de requête réseau).
    path = DATA_DIR / f"{symbol.upper()}.csv"
    if not path.exists():
        raise FileNotFoundError(f"Pas de données locales pour {symbol}")

    return pd.read_csv(path, index_col="Date", parse_dates=True)