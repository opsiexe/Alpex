from data.updater import update_symbol
from strategies.ma_crossover import get_latest_signal
from bot.risk import RiskParams, compute_position_size, compute_stop_take, can_open_position
from bot.broker import get_account, place_market_order, get_position
from config import SYMBOL, MA_SHORT, MA_LONG
from loguru import logger

RISK = RiskParams() # paramètres par défaut

def run_tick() -> None:
    logger.info(f"--- Tick [{SYMBOL}] ---")

    try:
        # 1. Données fraîches
        df = update_symbol(SYMBOL)

        # 2. Signal de la stratégie
        result = get_latest_signal(df, MA_SHORT, MA_LONG)
        logger.info(f"Signal : {result.signal.upper()} — {result.reason}")
        logger.info(f"Prix : ${result.price:.2f} | MA{MA_SHORT}: ${result.ma_short:.2f} | MA{MA_LONG}: ${result.ma_long:.2f}")

        if result.signal == "hold":
            return

        # 3. Vérification du risque
        account = get_account()
        positions = get_position()

        if not can_open_position(len(positions), RISK):
            return

        # 4. Calcul taille de position
        qty = compute_position_size(account["cash"], result.price, RISK)
        stop, target = compute_stop_take(result.price, result.signal, RISK)

        logger.info(f"Qty : {qty} | Stop : ${stop} | Target : ${target}")

        # 5. Passage de l'ordre
        order = place_market_order(SYMBOL, qty=qty, side=result.signal)
        logger.success(f"Ordre {result.signal.upper()} exécuté — id: {order.id}")

    except Exception as e:
        logger.error(f"Erreur tick : {e}")