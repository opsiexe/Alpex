import asyncio, json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from bot.broker import get_account
from bot.logger import log_buffer, register_ws_callback, unregister_ws_callback
from api.routes import fetch_candles
from api.ia import get_complete_trading_analysis
from api.routes import fetch_news

ws_router = APIRouter()

async def safe_send_text(ws: WebSocket, payload: dict) -> bool:
    if ws.client_state != WebSocketState.CONNECTED:
        return False
    try:
        await ws.send_text(json.dumps(payload))
        return True
    except (WebSocketDisconnect, RuntimeError):
        return False

@ws_router.websocket("/logs")
async def ws_logs(ws: WebSocket):
    await ws.accept()
    # Envoie le buffer existant au client qui vient de se connecter
    await safe_send_text(ws, {"type": "history", "data": list(log_buffer)})

    loop = asyncio.get_event_loop()
    def cb(entry):
        if ws.client_state != WebSocketState.CONNECTED:
            return
        asyncio.run_coroutine_threadsafe(
            safe_send_text(ws, {"type": "log", "data": entry}), loop
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
            if not await safe_send_text(ws, data):
                break
            await asyncio.sleep(3)
    except WebSocketDisconnect: pass


@ws_router.websocket("/candles")
async def ws_candles(ws: WebSocket, symbol: str = "AAPL", tf: str = "1h"):
    await ws.accept()
    symbol = symbol.upper()
    poll_seconds = 5 if tf in {"1m", "5m", "15m"} else 15

    try:
        history = await asyncio.to_thread(fetch_candles, symbol, tf, 300)
        await safe_send_text(ws, {"type": "history", "data": history})
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await safe_send_text(ws, {"type": "error", "message": str(exc)})

    try:
        while True:
            candles = await asyncio.to_thread(fetch_candles, symbol, tf, 2)
            if candles:
                if not await safe_send_text(ws, {"type": "candle", "data": candles[-1]}):
                    break
            await asyncio.sleep(poll_seconds)
    except WebSocketDisconnect:
        pass


@ws_router.websocket("/ai-news")
async def ws_ai_news(ws: WebSocket, symbol: str = "AAPL"):
    await ws.accept()
    symbol = symbol.upper()
    # Fréquence de rafraîchissement (ex: toutes les 60 secondes pour économiser l'API)
    poll_seconds = 60

    try:
        while True:
            # 1. Récupération des news
            news_items = await asyncio.to_thread(fetch_news, symbol, 10)

            if news_items:
                # 2. Analyse via le module IA
                ai_data = await asyncio.to_thread(get_complete_trading_analysis, news_items)

                if ai_data:
                    # 3. Enrichissement des news avec le sentiment
                    analysis_map = {item["id"]: item for item in ai_data.get("news_analysis", [])}
                    for idx, news in enumerate(news_items):
                        analysis = analysis_map.get(idx)
                        if analysis:
                            news["ai_sentiment"] = analysis.get("sentiment")
                            news["ai_score"] = analysis.get("score")

                    # 4. Envoi du package complet (Résumé + News tagguées)
                    if not await safe_send_text(ws, {
                        "type": "ai_update",
                        "symbol": symbol,
                        "global_summary": ai_data.get("global_summary"),
                        "news": news_items
                    }):
                        break

            await asyncio.sleep(poll_seconds)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await safe_send_text(ws, {"type": "error", "message": str(e)})
