import time

from loguru import logger

from bot.strategy_manager import StrategyManager


if __name__ == "__main__":
    manager = StrategyManager()
    manager.restore_running()
    if not manager.status().get("running"):
        manager.start_all()

    logger.info("Bot multi-stratégies démarré — en attente du prochain tick...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.warning("Arrêt manuel du bot.")
    finally:
        manager.stop_all()
