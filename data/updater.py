from data.fetcher import fetch_ohlcv, load_local, save_csv, save_sqlite
from loguru import logger
import pandas as pd

def update_symbol(symbol: str) -> pd.DataFrame:
    # Essaie de charger les données existantes
    try:
        existing = load_local(symbol)
        last_date = existing.index.max()
        logger.info(f"Données existantes jusqu'au {last_date.date()}")

        # Télécharge seulement depuis la dernière date
        fresh = fetch_ohlcv(symbol, period="5d")
        new_rows = fresh[fresh.index > last_date]

        if new_rows.empty:
            logger.info(f"Données déjà à jour")
            return existing

        df = pd.concat([existing, new_rows])
        logger.info(f"{len(new_rows)} nouvelles bougie ajoutées")

    except FileNotFoundError:
        # Première fois : Téléchargement complet su 2 ans
        logger.info("Première récupération - période de 2 ans")
        df = fetch_ohlcv(symbol, period="2y")

    save_csv(df, symbol)
    save_sqlite(df, symbol)
    return df