import asyncio, json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from bot.broker import get_account
from bot.logger import log_buffer, register_ws_callback, unregister_ws_callback

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