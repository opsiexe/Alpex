from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce, OrderType
from loguru import logger
from dotenv import load_dotenv
import os

load_dotenv()  # ← ajoute ça directement ici

client = TradingClient(
    os.getenv("ALPACA_API_KEY"),
    os.getenv("ALPACA_SECRET_KEY"),
    paper=True
)
# Connexion - paper=True = simulation, jamais d'argent réel
#client = TradingClient(ALPACA_KEY, ALPACA_SECRET, paper=True)

def get_account() -> dict:
    account = client.get_account()
    return {
        "cash": float(account.cash),
        "equity": float(account.equity),
        "buying_power": float(account.buying_power),
        "pnl": float(account.equity) - float(account.last_equity)
    }

def place_market_order(symbol: str, qty: int, side: str, client_order_id: str | None = None) -> object:
    # side = "buy" ou "sell"
    order_data = MarketOrderRequest(
        symbol=symbol,
        qty=qty,
        side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
        client_order_id=client_order_id,
    )

    order = client.submit_order(order_data)
    logger.info(f"Ordre {side.upper()} {qty}x{symbol} soumis - id: {order.id}")
    return order

def place_limit_order(symbol: str, qty: int, side: str, limit_price: float) -> object:
    order_data = LimitOrderRequest(
        symbol=symbol,
        qty=qty,
        side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
        time_in_force=TimeInForce.DAY,
        limit_price=limit_price,
    )
    order = client.submit_order(order_data)
    logger.info(f"Ordre LIMIT {side.upper()} {qty}x{symbol} @ ${limit_price}")
    return order

def get_position() -> list:
    return client.get_all_positions()

def cancel_all_orders() -> None:
    client.cancel_orders()
    logger.warning("Tout les ordres on été annulés.")

def close_all_positions() -> None:
    client.close_all_positions(cancel_orders=True)
    logger.warning("Toutes les positions on été fermées.")
