## Initialize connection to MT5 terminal
import MetaTrader5 as mt5

# Initialize connection
if not mt5.initialize():
    print("Initialize failed")
    mt5.shutdown()

# Get account info
account_info = mt5.account_info()
print("Balance:", account_info.balance)
print("Equity:", account_info.equity)

# Shutdown connection
mt5.shutdown()


## Get history of trades from MT5 terminal
import MetaTrader5 as mt5
from datetime import datetime

mt5.initialize()

# Get history from last 7 days
from_date = datetime(2026, 1, 1)
to_date = datetime.now()

trades = mt5.history_deals_get(from_date, to_date)
for trade in trades:
    print(trade)

mt5.shutdown()


## Create a Flask API to serve MT5 trade data
from flask import Flask, jsonify, request
from flask_cors import CORS
import MetaTrader5 as mt5
from datetime import datetime

app = Flask(__name__)
CORS(app)  # ✅ Enable CORS for all routes

def trade_type_label(t_type):
    if t_type == 0:
        return "Buy"
    elif t_type == 1:
        return "Sell"
    elif t_type == 2:
        return "Balance"
    else:
        return "Unknown"
    
## open trades
@app.route("/portfolio")
def get_portfolio():
    mt5.initialize()
    positions = mt5.positions_get()
    mt5.shutdown()

    portfolio_list = []
    for p in positions:
        portfolio_list.append({
            "symbol": p.symbol,
            "volume": p.volume,
            "price": p.price,
            "profit": p.profit,
            "trade": trade_type_label(p.type)  # ✅ mapped label
        })

    if positions is None or len(positions) == 0:
        return jsonify({"error": "No open positions"})
    return jsonify(portfolio_list)


## TAccount overall performance

@app.route("/trades")
def get_trades():
    mt5.initialize()
    trades = mt5.history_deals_get(datetime(2026,1,1), datetime.now())
    mt5.shutdown()

    if trades is None or len(trades) == 0:
        return jsonify({"error": "No trades found"})

    trade_list = []
    for t in trades:
        trade_list.append({
            "symbol": t.symbol,
            "type": t.type,
            "volume": t.volume,
            "price": t.price,
            "profit": t.profit
        })

    return jsonify(trade_list)


## Trade Logs
@app.route("/performance")
def get_performance():
    mt5.initialize()
    trades = mt5.history_deals_get(datetime(2026,1,1), datetime.now())
    mt5.shutdown()

    if trades is None or len(trades) == 0:
        return jsonify({
            "error": "No trades found",
            "equity_curve": []
        })

    # Build equity curve
    equity_curve, balance = [], 0
    for t in trades:
        balance += t.profit
        equity_curve.append(round(balance, 2))

    # Metrics
    wins = sum(1 for t in trades if t.profit > 0)
    losses = sum(1 for t in trades if t.profit < 0)
    total_pnl = sum(t.profit for t in trades)
    win_rate = (wins / (wins + losses) * 100) if (wins + losses) > 0 else 0

    peak, max_dd = 0, 0
    for v in equity_curve:
        peak = max(peak, v)
        dd = ((peak - v) / peak * 100) if peak > 0 else 0
        max_dd = max(max_dd, dd)

    return jsonify({
        "total_pnl": round(total_pnl, 2),
        "win_rate": round(win_rate, 2),
        "max_drawdown": round(max_dd, 2),
        "equity_curve": equity_curve   # ✅ send curve
    })

## equity curve
@app.route("/equity_curves")
def get_equity_curves():
    mt5.initialize()
    trades = mt5.history_deals_get(datetime(2026,1,1), datetime.now())
    mt5.shutdown()

    if trades is None or len(trades) == 0:
        return jsonify({"error": "No trades found", "curves": {}})

    curves = {}
    balances = {}

    for t in trades:
        sym = t.symbol
        if sym not in balances:
            balances[sym] = 0
            curves[sym] = []
        balances[sym] += t.profit
        curves[sym].append(round(balances[sym], 2))

    return jsonify({"curves": curves})

## equity curve by month
@app.route("/monthly_performance")
def get_monthly_performance():
    mt5.initialize()
    trades = mt5.history_deals_get(datetime(2026,1,1), datetime.now())
    mt5.shutdown()

    if trades is None or len(trades) == 0:
        return jsonify({"error": "No trades found"})

    monthly = {}
    for t in trades:
        month = datetime.fromtimestamp(t.time).strftime("%Y-%m")
        if month not in monthly:
            monthly[month] = 0
        monthly[month] += t.profit

    return jsonify(monthly)


## pie chart
@app.route("/symbol_stats")
def get_symbol_stats():
    mt5.initialize()
    trades = mt5.history_deals_get(datetime(2026,1,1), datetime.now())
    mt5.shutdown()

    if trades is None or len(trades) == 0:
        return jsonify({"error": "No trades found"})

    stats = {}
    for t in trades:
        sym = t.symbol
        if sym not in stats:
            stats[sym] = {"wins": 0, "losses": 0, "count": 0, "pnl": 0}

        # ✅ Only count trades with profit ≠ 0
        if t.profit > 0:
            stats[sym]["wins"] += 1
            stats[sym]["count"] += 1
        elif t.profit < 0:
            stats[sym]["losses"] += 1
            stats[sym]["count"] += 1

        # ✅ Track cumulative profit/loss
        stats[sym]["pnl"] += t.profit

    return jsonify(stats)


## calender
@app.route("/daily_activity")
def get_daily_activity():
    year = int(request.args.get("year", datetime.now().year))
    month = int(request.args.get("month", datetime.now().month))

    start = datetime(year, month, 1)
    end = datetime(year, month+1, 1) if month < 12 else datetime(year+1, 1, 1)

    mt5.initialize()
    trades = mt5.history_deals_get(start, end)
    mt5.shutdown()

    daily = {}
    for t in trades:
        day = datetime.fromtimestamp(t.time).strftime("%Y-%m-%d")
        if day not in daily:
            daily[day] = {"pnl": 0}
        daily[day]["pnl"] += t.profit

    return jsonify(daily)




## Playbook





if __name__ == "__main__":
    app.run(port=5000)


    ## Save MT5 trade data to a local SQLite database
import sqlite3

def save_trades(trades):
    conn = sqlite3.connect("trades.db")
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY,
        symbol TEXT,
        volume REAL,
        price REAL,
        profit REAL,
        time INTEGER
    )""")

    for t in trades:
        c.execute("INSERT INTO trades (symbol, volume, price, profit, time) VALUES (?, ?, ?, ?, ?)",
                  (t.symbol, t.volume, t.price, t.profit, t.time))
    conn.commit()
    conn.close()
