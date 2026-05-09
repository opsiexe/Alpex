from loguru import logger

from bot.strategy_manager import StrategyManager


class BotManager:
    def __init__(self):
        self.strategy_manager = StrategyManager()

    @property
    def store(self):
        return self.strategy_manager.store

    def start(self) -> dict:
        logger.success("Démarrage global des stratégies via API")
        return self.strategy_manager.start_all()

    def stop(self) -> dict:
        logger.warning("Arrêt global des stratégies via API")
        return self.strategy_manager.stop_all()

    def status(self) -> dict:
        return self.strategy_manager.status()

    def restore(self) -> None:
        self.strategy_manager.restore_running()


bot_manager = BotManager()
