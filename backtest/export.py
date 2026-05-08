import json
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("data")


def export_results(metrics: dict, symbol: str, params: dict) -> Path:
    payload = {
        "symbol": symbol,
        "params": params,
        "run_at": datetime.now().isoformat(),
        "metrics": {k: v for k, v in metrics.items() if k != "trades"},
        "trades": metrics.get("trades", []),
    }
    path = DATA_DIR / f"backtest_{symbol}_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    path.write_text(json.dumps(payload, indent=2))
    return path