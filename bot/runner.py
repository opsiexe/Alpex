from loguru import logger

from bot.strategy_executor import execute_strategy
from data.strategy_store import strategy_store
from strategies.registry import DEFAULT_STRATEGIES


def run_tick() -> None:
    logger.info("--- Tick (MA Crossover) ---")
    strategy_store.ensure_defaults(DEFAULT_STRATEGIES)
    strategy = strategy_store.get_strategy("ma-crossover")
    if strategy is None:
        logger.error("Stratégie MA Crossover introuvable.")
        return
    execute_strategy(strategy, strategy_store)
