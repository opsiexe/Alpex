import threading
from apscheduler.schedulers.background import BackgroundScheduler
from bot.runner import run_tick
from loguru import logger

class BotManager:
    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone="America/New_York")
        self.running = False

    def start(self) -> dict:
        if self.running:
            return {"ok": False, "msg": "Déjà démarré"}
        self.scheduler.add_job(
            run_tick, "cron",
            day_of_week="mon-fri", hour="9-15", minute="*/5",
            id="bot_tick", replace_existing=True,
        )
        self.scheduler.start()
        self.running = True
        logger.success("Bot démarré via API")
        return {"ok": True, "msg": "Bot démarré"}

    def stop(self) -> dict:
        if not self.running:
            return {"ok": False, "msg": "Déjà arrêté"}
        self.scheduler.shutdown(wait=False)
        self.running = False
        logger.warning("Bot arrêté via API")
        return {"ok": True, "msg": "Bot arrêté"}

    def status(self) -> dict:
        return {"running": self.running}


bot_manager = BotManager()