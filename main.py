from loguru import logger
from data.updater import update_symbol
from data.fetcher import fetch_ohlcv
from bot.broker import get_account, place_market_order, get_position

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

    # 1. Vérifier le compte
    account = get_account()
    logger.info(f"Cash disponible : ${account['cash']:,.2f}")
    logger.info(f"Equity totale : ${account['equity']:,.2f}")

    # 2. Passer un ordre market BUY — 5 actions AAPL
    order = place_market_order("NVDA", qty=5, side="buy")
    logger.info(f"Statut ordre : {order.status}")

    # 3. Voir les positions ouvertes

    positions = get_position()
    for p in positions:
        logger.info(f"{p.symbol} - qty:{p.qty} - P&L: ${float(p.unrealized_pl):.2f}")