import backtrader as bt


class MACrossover(bt.Strategy):
    params = (
        ("short_window", 20),
        ("long_window", 50),
        ("stop_loss_pct", 0.02),
        ("risk_pct", 0.02),
    )

    def __init__(self):
        self.ma_short = bt.ind.SMA(self.data.close, period=self.p.short_window)
        self.ma_long = bt.ind.SMA(self.data.close, period=self.p.long_window)
        self.crossover = bt.ind.CrossOver(self.ma_short, self.ma_long)
        self.order = None
        self.stop_price = None
        self.trades = []

    def next(self):
        # Stop-loss manuel
        if self.position and self.stop_price:
            if self.data.close[0] <= self.stop_price:
                self.close()
                self.stop_price = None
                return

        if self.order:
            return  # ordre en cours

        if self.crossover > 0 and not self.position:
            # Signal haussier → BUY
            cash = self.broker.getcash()
            price = self.data.close[0]
            risk_amount = cash * self.p.risk_pct
            risk_per_share = price * self.p.stop_loss_pct
            qty = int(risk_amount / risk_per_share)
            if qty > 0:
                self.order = self.buy(size=qty)
                self.stop_price = price * (1 - self.p.stop_loss_pct)

        elif self.crossover < 0 and self.position:
            # Signal baissier → SELL (clôture position)
            self.order = self.close()
            self.stop_price = None

    def notify_order(self, order):
        if order.status in [order.Completed, order.Canceled, order.Margin]:
            self.order = None

    def notify_trade(self, trade):
        if trade.isclosed:
            self.trades.append({
                "pnl": round(trade.pnl, 2),
                "pnlcomm": round(trade.pnlcomm, 2),
            })