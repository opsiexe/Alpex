import threading
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from loguru import logger

from bot.strategy_executor import execute_strategy
from data.strategy_store import StrategyRecord, StrategyStore, strategy_store
from strategies.registry import DEFAULT_STRATEGIES, DEFINITIONS_BY_ID

DEFAULT_SCHEDULE = {
    "day_of_week": "mon-fri",
    "hour": "9-15",
    "minute": "*/5",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StrategyManager:
    def __init__(self, store: StrategyStore | None = None):
        self.store = store or strategy_store
        self.scheduler = BackgroundScheduler(timezone="America/New_York")
        self._scheduler_started = False
        self._lock = threading.Lock()
        self.store.ensure_defaults(DEFAULT_STRATEGIES)

    def list_strategies(self) -> list[dict[str, Any]]:
        strategies = self.store.list_strategies()
        response: list[dict[str, Any]] = []
        for strategy in strategies:
            definition = DEFINITIONS_BY_ID.get(strategy.id)
            response.append(
                {
                    "id": strategy.id,
                    "name": strategy.name,
                    "type": strategy.type,
                    "symbols": strategy.symbols,
                    "parameters": strategy.parameters,
                    "status": strategy.status,
                    "ai": bool(definition.ai) if definition else False,
                    "tags": list(definition.tags) if definition else [],
                    "multi": len(strategy.symbols) > 1,
                    "performance": {"percent": 0, "pnl": 0},
                }
            )
        return response

    def start_strategy(self, strategy_id: str) -> dict[str, Any]:
        with self._lock:
            strategy = self.store.get_strategy(strategy_id)
            if strategy is None:
                return {"ok": False, "msg": "Stratégie introuvable"}
            if strategy.status == "running":
                return {"ok": False, "msg": "Stratégie déjà active"}
            self._ensure_scheduler_started()
            self._schedule_strategy(strategy)
            self.store.update_strategy(strategy_id, status="running", last_error=None)
            threading.Thread(target=self._run_strategy_once, args=(strategy_id,), daemon=True).start()
            return {"ok": True, "msg": "Stratégie démarrée"}

    def stop_strategy(self, strategy_id: str) -> dict[str, Any]:
        with self._lock:
            strategy = self.store.get_strategy(strategy_id)
            if strategy is None:
                return {"ok": False, "msg": "Stratégie introuvable"}
            job_id = self._job_id(strategy_id)
            if self._scheduler_started:
                try:
                    self.scheduler.remove_job(job_id)
                except Exception:
                    pass
            self.store.update_strategy(strategy_id, status="stopped")
            return {"ok": True, "msg": "Stratégie arrêtée"}

    def update_config(
        self,
        strategy_id: str,
        *,
        symbols: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if symbols is not None:
            symbols = [item.strip().upper() for item in symbols if item.strip()]
        if parameters is not None:
            parameters = {key: value for key, value in parameters.items()}
        updated = self.store.update_strategy(strategy_id, symbols=symbols, parameters=parameters)
        if updated is None:
            return {"ok": False, "msg": "Stratégie introuvable"}
        if updated.status == "running":
            self._reschedule(updated)
        return {"ok": True, "msg": "Configuration mise à jour", "strategy": updated.id}

    def restore_running(self) -> None:
        strategies = self.store.list_strategies()
        for strategy in strategies:
            if strategy.status == "running":
                self._ensure_scheduler_started()
                self._schedule_strategy(strategy)

    def start_all(self) -> dict[str, Any]:
        strategies = self.store.list_strategies()
        for strategy in strategies:
            self.start_strategy(strategy.id)
        return {"ok": True, "msg": "Toutes les stratégies ont été démarrées"}

    def stop_all(self) -> dict[str, Any]:
        with self._lock:
            if self._scheduler_started:
                self.scheduler.shutdown(wait=False)
                self._scheduler_started = False
            for strategy in self.store.list_strategies():
                self.store.update_strategy(strategy.id, status="stopped")
        return {"ok": True, "msg": "Toutes les stratégies ont été arrêtées"}

    def status(self) -> dict[str, Any]:
        strategies = self.store.list_strategies()
        running = [s for s in strategies if s.status == "running"]
        return {"running": bool(running), "active_count": len(running)}

    def _ensure_scheduler_started(self) -> None:
        if not self._scheduler_started:
            self.scheduler.start()
            self._scheduler_started = True

    def _schedule_strategy(self, strategy: StrategyRecord) -> None:
        schedule = strategy.parameters.get("schedule")
        if not isinstance(schedule, dict):
            schedule = DEFAULT_SCHEDULE
        self.scheduler.add_job(
            self._run_strategy_once,
            "cron",
            id=self._job_id(strategy.id),
            replace_existing=True,
            args=[strategy.id],
            **schedule,
        )

    def _reschedule(self, strategy: StrategyRecord) -> None:
        if not self._scheduler_started:
            return
        try:
            self.scheduler.remove_job(self._job_id(strategy.id))
        except Exception:
            pass
        self._schedule_strategy(strategy)

    def _run_strategy_once(self, strategy_id: str) -> None:
        strategy = self.store.get_strategy(strategy_id)
        if strategy is None:
            return
        try:
            execute_strategy(strategy, self.store)
            self.store.update_strategy(strategy_id, last_error=None, last_run_at=_utc_now())
        except Exception as exc:
            logger.error("Erreur stratégie {}: {}", strategy_id, exc)
            self.store.update_strategy(strategy_id, status="error", last_error=str(exc), last_run_at=_utc_now())

    @staticmethod
    def _job_id(strategy_id: str) -> str:
        return f"strategy:{strategy_id}"
