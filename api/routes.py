from fastapi import APIRouter
from bot.broker import get_account, get_position
from bot.logger import log_buffer
from api.bot_manager import bot_manager
from config import MA_SHORT, MA_LONG, SYMBOL

router = APIRouter()
# --- Compte ---
@router.get("/account")
async def account():
    return get_account()

@router.get("/positions")
async def positions():
    return [{"symbol": p.symbol, "qty": p.qty,
             "pnl": float(p.unrealized_pl)} for p in get_position()]

# --- Bot ---
@router.post("/bot/start")
async def bot_start(): return bot_manager.start()

@router.post("/bot/stop")
async def bot_stop(): return bot_manager.stop()

@router.get("/bot/status")
async def bot_status(): return bot_manager.status()

# --- Config stratégie ---
@router.get("/config")
async def get_config():
    return {"symbol": SYMBOL, "ma_short": MA_SHORT, "ma_long": MA_LONG}

# --- Logs ---
@router.get("/logs")
async def get_logs(limit: int = 100):
    return list(log_buffer)[-limit:]