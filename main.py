from loguru import logger
from data.updater import update_symbol
from data.fetcher import fetch_ohlcv

if __name__ == "__main__":

    WATCHLIST = ["AAPL", "NVDA", "MSFT", "SPY"]

    # Récupérer et stocker NVDA
    df = update_symbol("NVDA")
    print(df.tail())

    # vérifier les colonnes
    print("\nColonnes :", df.columns.tolist())
    print("Lignes :", len(df))
    print("Dernière bougie :", df.index[-1].date())

    for symbol in WATCHLIST:
        try:
            update_symbol(symbol)
        except Exception as e:
            logger.error(f"Erreur {symbol} : {e}")