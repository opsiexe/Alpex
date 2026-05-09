import asyncio, json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from bot.broker import get_account
from bot.logger import log_buffer, register_ws_callback, unregister_ws_callback
from api.routes import fetch_candles

ws_router = APIRouter()

@ws_router.websocket("/logs")
async def ws_logs(ws: WebSocket):
    await ws.accept()
    # Envoie le buffer existant au client qui vient de se connecter
    await ws.send_text(json.dumps({"type": "history", "data": list(log_buffer)}))

    loop = asyncio.get_event_loop()
    def cb(entry):
        asyncio.run_coroutine_threadsafe(
            ws.send_text(json.dumps({"type": "log", "data": entry})), loop
        )

    register_ws_callback(cb)
    try:
        while True: await ws.receive_text() # garde la connexion ouverte
    except WebSocketDisconnect:
        unregister_ws_callback(cb)

@ws_router.websocket("/metrics")
async def ws_metrics(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = get_account() # push métriques toutes les 3s
            await ws.send_text(json.dumps(data))
            await asyncio.sleep(3)
    except WebSocketDisconnect: pass


@ws_router.websocket("/candles")
async def ws_candles(ws: WebSocket, symbol: str = "AAPL", tf: str = "1h"):
    await ws.accept()
    symbol = symbol.upper()
    poll_seconds = 5 if tf in {"1m", "5m", "15m"} else 15

    try:
        history = await asyncio.to_thread(fetch_candles, symbol, tf, 300)
        await ws.send_text(json.dumps({"type": "history", "data": history}))
    except Exception as exc:
        await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))

    try:
        while True:
            candles = await asyncio.to_thread(fetch_candles, symbol, tf, 2)
            if candles:
                await ws.send_text(json.dumps({"type": "candle", "data": candles[-1]}))
            await asyncio.sleep(poll_seconds)
    except WebSocketDisconnect:
        pass
