from dotenv import load_dotenv
import os

load_dotenv()

ALPACA_KEY = os.getenv("ALPACA_API_KEY")
ALPACA_SECRET = os.getenv("ALPACA_API_SECRET")
ALPACA_BASE_URL = os.getenv("ALPACA_BASE_URL")
SYMBOL = os.getenv("SYMBOL")
MA_SHORT = int(os.getenv("MA_SHORT", 20))
MA_LONG = int(os.getenv("MA_LONG", 50))