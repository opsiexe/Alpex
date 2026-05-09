import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from loguru import logger

from strategies.registry import DEFAULT_STRATEGIES, DEFINITIONS_BY_ID, StrategyDefinition

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "strategies.db"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class StrategyRecord:
    id: str
    name: str
    type: str
    symbols: list[str]
    parameters: dict[str, Any]
    status: str
    last_error: str | None
    last_run_at: str | None


class StrategyStore:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._ensure_tables()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _ensure_tables(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS strategies (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    symbols TEXT NOT NULL,
                    parameters TEXT NOT NULL,
                    status TEXT NOT NULL,
                    last_error TEXT,
                    last_run_at TEXT,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS trade_metadata (
                    order_id TEXT PRIMARY KEY,
                    strategy_id TEXT,
                    strategy_name TEXT,
                    symbol TEXT,
                    signal TEXT,
                    technical_signal TEXT,
                    ai_explanation TEXT,
                    news_json TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_trade_metadata_strategy ON trade_metadata(strategy_id)"
            )

    def ensure_defaults(self, definitions: list[StrategyDefinition] | None = None) -> None:
        definitions = definitions or DEFAULT_STRATEGIES
        with self._connect() as conn:
            for definition in definitions:
                row = conn.execute(
                    "SELECT symbols, parameters, status FROM strategies WHERE id = ?",
                    (definition.id,),
                ).fetchone()
                if row is None:
                    conn.execute(
                        """
                        INSERT INTO strategies
                        (id, name, type, symbols, parameters, status, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            definition.id,
                            definition.name,
                            definition.type,
                            json.dumps(definition.default_symbols),
                            json.dumps(definition.default_parameters),
                            "stopped",
                            _utc_now(),
                        ),
                    )
                    continue

                symbols = json.loads(row[0]) if row[0] else []
                params = json.loads(row[1]) if row[1] else {}
                status = row[2] or "stopped"
                merged_params = {**definition.default_parameters, **params}
                final_symbols = symbols or definition.default_symbols

                conn.execute(
                    """
                    UPDATE strategies
                    SET name = ?, type = ?, symbols = ?, parameters = ?, status = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        definition.name,
                        definition.type,
                        json.dumps(final_symbols),
                        json.dumps(merged_params),
                        status,
                        _utc_now(),
                        definition.id,
                    ),
                )

    def list_strategies(self) -> list[StrategyRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, name, type, symbols, parameters, status, last_error, last_run_at FROM strategies"
            ).fetchall()
        return [self._row_to_record(row) for row in rows]

    def get_strategy(self, strategy_id: str) -> StrategyRecord | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, name, type, symbols, parameters, status, last_error, last_run_at "
                "FROM strategies WHERE id = ?",
                (strategy_id,),
            ).fetchone()
        return self._row_to_record(row) if row else None

    def update_strategy(
        self,
        strategy_id: str,
        *,
        symbols: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
        status: str | None = None,
        last_error: str | None = None,
        last_run_at: str | None = None,
    ) -> StrategyRecord | None:
        existing = self.get_strategy(strategy_id)
        if existing is None:
            return None

        new_symbols = symbols if symbols is not None else existing.symbols
        new_parameters = parameters if parameters is not None else existing.parameters
        new_status = status if status is not None else existing.status

        with self._connect() as conn:
            conn.execute(
                """
                UPDATE strategies
                SET symbols = ?, parameters = ?, status = ?, last_error = ?, last_run_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    json.dumps(new_symbols),
                    json.dumps(new_parameters),
                    new_status,
                    last_error,
                    last_run_at,
                    _utc_now(),
                    strategy_id,
                ),
            )

        return self.get_strategy(strategy_id)

    def record_trade_metadata(
        self,
        *,
        order_id: str,
        strategy_id: str,
        symbol: str,
        signal: str,
        technical_signal: str | None = None,
        ai_explanation: str | None = None,
        news: dict[str, Any] | None = None,
    ) -> None:
        definition = DEFINITIONS_BY_ID.get(strategy_id)
        strategy_name = definition.name if definition else strategy_id
        news_json = json.dumps(news) if news else None

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO trade_metadata
                (order_id, strategy_id, strategy_name, symbol, signal, technical_signal, ai_explanation, news_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(order_id) DO UPDATE SET
                    strategy_id = excluded.strategy_id,
                    strategy_name = excluded.strategy_name,
                    symbol = excluded.symbol,
                    signal = excluded.signal,
                    technical_signal = excluded.technical_signal,
                    ai_explanation = excluded.ai_explanation,
                    news_json = excluded.news_json,
                    created_at = excluded.created_at
                """,
                (
                    order_id,
                    strategy_id,
                    strategy_name,
                    symbol,
                    signal,
                    technical_signal,
                    ai_explanation,
                    news_json,
                    _utc_now(),
                ),
            )

    def fetch_trade_metadata_map(self, order_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not order_ids:
            return {}
        placeholders = ",".join(["?"] * len(order_ids))
        query = (
            "SELECT order_id, strategy_id, strategy_name, symbol, signal, technical_signal, ai_explanation, news_json "
            f"FROM trade_metadata WHERE order_id IN ({placeholders})"
        )
        with self._connect() as conn:
            rows = conn.execute(query, order_ids).fetchall()

        metadata_map: dict[str, dict[str, Any]] = {}
        for row in rows:
            news = None
            if row[7]:
                try:
                    news = json.loads(row[7])
                except json.JSONDecodeError:
                    logger.warning("News JSON invalide pour l'ordre {}", row[0])
            metadata_map[row[0]] = {
                "order_id": row[0],
                "strategy_id": row[1],
                "strategy_name": row[2],
                "symbol": row[3],
                "signal": row[4],
                "technical_signal": row[5],
                "ai_explanation": row[6],
                "news": news,
            }
        return metadata_map

    @staticmethod
    def _row_to_record(row: sqlite3.Row | tuple) -> StrategyRecord:
        symbols = json.loads(row[3]) if row[3] else []
        parameters = json.loads(row[4]) if row[4] else {}
        return StrategyRecord(
            id=row[0],
            name=row[1],
            type=row[2],
            symbols=symbols,
            parameters=parameters,
            status=row[5],
            last_error=row[6],
            last_run_at=row[7],
        )


strategy_store = StrategyStore()
