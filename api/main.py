from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from bot.logger import setup_logger
from api.routes import router
from api.ws import ws_router
from api.bot_manager import bot_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logger() # logs dès le démarrage
    yield
    bot_manager.stop() # arrêt propre si le bot tourne

app = FastAPI(title="Alpex API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # restreindre en prod
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(ws_router, prefix="/ws")