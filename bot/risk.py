from dataclasses import dataclass
from loguru import logger


@dataclass
class RiskParams:
    risk_pct: float = 0.02 # risque max 2% du capital par trade
    stop_loss_pct: float = 0.02 # stop-loss à -2% du prix d'entrée
    take_profit_pct: float = 0.05 # take-profit à +5% du prix d'entrée
    max_positions: int = 3 # max 3 positions ouvertes simultanées

def compute_position_size(
    capital: float,
    price: float,
    params: RiskParams,
) -> int:
    # Combien d'actions acheter pour ne risquer que risk_pct du capital
    # Formule : nb_actions = (capital × risk_pct) / (prix × stop_loss_pct)
    risk_amount = capital * params.risk_pct
    risk_per_share = price * params.stop_loss_pct

    if risk_per_share == 0:
        return 0

    qty = int(risk_amount / risk_per_share)
    logger.debug(f"Position size : {qty} actions (risque ${risk_amount:.2f})")
    return max(1, qty) # minimum 1 action

def compute_stop_take(
    entry_price: float,
    side: str,
    params: RiskParams,
) -> tuple[float, float]:
    # Retourne (stop_loss_price, take_profit_price)
    if side == "buy":
        stop = entry_price * (1 - params.stop_loss_pct)
        target = entry_price * (1 + params.take_profit_pct)
    else:
        stop = entry_price * (1 + params.stop_loss_pct)
        target = entry_price * (1 - params.take_profit_pct)
    return round(stop, 2), round(target, 2)

def can_open_position(
    open_positions: int,
    params: RiskParams,
) -> bool:
    if open_positions >= params.max_positions:
        logger.warning(f"Max positions atteint ({params.max_positions})")
        return False
    return True