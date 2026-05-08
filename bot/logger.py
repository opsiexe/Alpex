from loguru import logger
from pathlib import Path
import sys
from collections import deque

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# Buffer en mémoire : derniers 200 logs (pour le client qui se connecte tard)
log_buffer: deque = deque(maxlen=200)

# Callbacks WebSocket — les clients abonnés reçoivent chaque log en live
_ws_callbacks: list = []

def register_ws_callback(cb) -> None:
    _ws_callbacks.append(cb)

def unregister_ws_callback(cb) -> None:
    _ws_callbacks.discard(cb) if hasattr(_ws_callbacks, 'discard') else None
    try: _ws_callbacks.remove(cb)
    except ValueError: pass

def _sink(message) -> None:
    # Appelé pour chaque log — stocke + diffuse aux clients WS
    record = message.record
    entry = {
        "time": record["time"].strftime("%H:%M:%S"),
        "level": record["level"].name,
        "message": record["message"],
    }
    log_buffer.append(entry)
    for cb in list(_ws_callbacks):
        try: cb(entry)
        except: pass

def setup_logger() -> None:
    logger.remove() # Supprime le handler par défaut

    # 1. Console colorée
    logger.add(sys.stdout, colorize=True, level="DEBUG",
               format="<green>{time:HH:mm:ss}</green> <level>{level:<8}</level> {message}")

    # 2. Fichier rotatif — 10 Mo max, 7 jours de rétention
    logger.add(
        LOG_DIR / "alpex_{time:YYYY-MM-DD}.log",
        rotation="10 MB", retention="7 days",
        level="INFO", encoding="utf-8",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}",
    )

    # 3. Sink custom → buffer + WebSocket
    logger.add(_sink, level="DEBUG")