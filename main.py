from apscheduler.schedulers.blocking import BlockingScheduler
from bot.runner import run_tick
from loguru import logger

scheduler = BlockingScheduler(timezone="America/New_York")

# Tourne toutes les 5 min, uniquement pendant les heures de marché
scheduler.add_job(
    run_tick,
    "cron",
    day_of_week="mon-fri",
    hour="9-15",
    minute="*/5",
)

if __name__ == "__main__":
    logger.info("Bot démarré — en attente du prochain tick...")
    run_tick() # tick immédiat au lancement
    scheduler.start() # puis boucle automatique