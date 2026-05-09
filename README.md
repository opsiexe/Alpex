<img width="1672" height="467" alt="alpex-github-banner" src="https://github.com/user-attachments/assets/5fff8173-6668-4a25-97cd-c766a02cd885" />

# Alpex — AI-Powered Trading Platform

> Plateforme de trading algorithmique augmentée par l'IA. Combinez l'analyse technique classique avec l'intelligence contextuelle des marchés financiers.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)
![Alpaca](https://img.shields.io/badge/Alpaca-Paper%20%2F%20Live-FBAE17?style=flat)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)

---

## Vue d'ensemble

Alpex est une plateforme de trading algorithmique conçue autour d'une architecture client/serveur : un bot Python tourne en autonomie sur un serveur, et une interface web (ou desktop via Electron) permet de le piloter à distance en temps réel.

L'objectif à terme est d'intégrer un LLM (GPT-4, Claude, Gemini…) capable de lire l'actualité financière, d'interpréter les signaux de marché et d'expliquer chaque décision de trading en langage naturel.

```
┌─────────────────────────────────┐     ┌──────────────────────┐
│         Serveur (VPS)           │     │    Client (web/app)   │
│                                 │     │                       │
│  Bot Python ──► FastAPI         │◄───►│  React + Vite         │
│     │           REST + WebSocket│     │  Tailwind CSS         │
│     ▼                           │     │  lightweight-charts   │
│  Alpaca API  ◄──── yfinance     │     └──────────────────────┘
└─────────────────────────────────┘
```

---

## Fonctionnalités

### Actuelles
- Stratégie **MA Crossover** configurable (fenêtres courte/longue paramétrables)
- **Gestion du risque** intégrée : position sizing, stop-loss, take-profit, max positions simultanées
- **Backtesting** complet via Backtrader avec métriques Sharpe, drawdown, win rate
- **Walk-forward validation** anti-overfitting (split train/test 70/30)
- **API REST + WebSocket** via FastAPI — métriques live, logs streaming, contrôle start/stop
- **Interface web** React avec dashboard, historique des ordres, console de logs temps réel, page de résultats backtest
- **Logs rotatifs** avec Loguru (fichier + stream WebSocket)
- Mode **paper trading** Alpaca (simulation sans argent réel)

### Roadmap
- [ ] Graphique en bougies japonaises style TradingView (`lightweight-charts`)
- [ ] Fil d'actualités financières avec scoring de sentiment par IA
- [ ] Gestionnaire multi-stratégies (création, édition, symboles par stratégie)
- [ ] Historique des trades enrichi — explication IA de chaque décision
- [ ] Backtest lancé directement depuis l'interface web
- [ ] Assistant IA contextuel (chat flottant, ⌘K command palette)
- [ ] Intégration LLM configurable (GPT-4, Claude, Gemini)
- [ ] Alertes Telegram
- [ ] Application desktop Electron (même codebase React)
- [ ] Passage en live trading

---

## Stack technique

| Couche | Technologie |
|---|---|
| Bot | Python 3.11, APScheduler, Loguru |
| Données | yfinance, SQLite |
| Broker | Alpaca Markets (`alpaca-py`) |
| Backtesting | Backtrader, NumPy, pandas |
| API | FastAPI, Uvicorn, WebSocket |
| Frontend | React 18, Vite, Tailwind CSS v4 |
| Graphiques | lightweight-charts |
| Icônes | Lucide React |
| Desktop (roadmap) | Electron |

---

## Structure du projet

```
alpex/
├── bot/
│   ├── broker.py          # Client Alpaca (ordres, positions, compte)
│   ├── runner.py          # Boucle principale d'exécution
│   ├── risk.py            # Position sizing, stop-loss, take-profit
│   └── logger.py          # Configuration Loguru + broadcast WebSocket
├── strategies/
│   └── ma_crossover.py    # Stratégie MA Crossover
├── backtest/
│   ├── strategy.py        # Stratégie Backtrader
│   ├── runner.py          # Moteur de backtest
│   ├── metrics.py         # Calcul Sharpe, drawdown, win rate
│   ├── walk_forward.py    # Validation anti-overfitting
│   └── export.py          # Export JSON des résultats
├── data/
│   ├── fetcher.py         # Récupération yfinance + stockage local
│   └── updater.py         # Mise à jour incrémentale des données
├── api/
│   ├── main.py            # App FastAPI + CORS + lifespan
│   ├── routes.py          # Endpoints REST
│   ├── ws.py              # WebSocket logs + métriques
│   └── bot_manager.py     # Gestion start/stop du bot
├── frontend/
│   └── src/
│       ├── api/client.js          # Appels FastAPI centralisés
│       ├── hooks/useWebSocket.js  # Hook WebSocket auto-reconnect
│       ├── components/            # Sidebar, MetricCard, LogConsole…
│       └── pages/                 # Dashboard, History, Backtest, Settings
├── logs/                  # Fichiers de logs rotatifs (gitignorés)
├── data/                  # CSV + SQLite (gitignorés)
├── config.py              # Lecture des variables d'environnement
├── main.py                # Point d'entrée du bot
├── main_backtest.py       # Lancement des backtests multi-config
└── requirements.txt
```

---

## Installation

### Prérequis

- Python 3.11+
- Node.js 18+
- Un compte [Alpaca Markets](https://alpaca.markets) (gratuit, paper trading disponible)

### Backend

```bash
# Cloner le projet
git clone https://github.com/ton-username/alpex.git
cd alpex

# Environnement virtuel
python -m venv .venv
source .venv/bin/activate  # Windows : .venv\Scripts\Activate.ps1

# Dépendances
pip install -r requirements.txt

# Configuration
cp .env.example .env
# Renseigner les clés Alpaca dans .env
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Lancement

```bash
# Terminal 1 — API + Bot
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend && npm run dev

# Ouvre http://localhost:5173
```

---

## Configuration

Copier `.env.example` en `.env` et renseigner les valeurs :

```env
# Alpaca API (paper trading)
ALPACA_API_KEY=PKxxxxxxxxxxxxxxxx
ALPACA_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Stratégie
SYMBOL=AAPL
MA_SHORT=10
MA_LONG=30
```

---

## Backtesting

```bash
# Récupérer les données localement d'abord
python -c "from data.updater import update_symbol; update_symbol('NVDA')"

# Lancer le backtest multi-config
python main_backtest.py
```

Exemple de sortie :

```
MA 5/MA 20 →  18 trades | return:  12.40% | sharpe:  6.241 | drawdown:  8.12% | win rate:  61.1%
MA10/MA 30 →   9 trades | return:   8.10% | sharpe:  5.103 | drawdown: 10.45% | win rate:  55.6%
MA20/MA 50 →   4 trades | return:   2.48% | sharpe:  4.862 | drawdown:  8.32% | win rate:  50.0%
Meilleure config : MA5/MA20 (sharpe 6.241)
```

Les résultats sont exportés en JSON dans `data/` et chargeable directement depuis l'interface web (page Backtest).

---

## API

Une fois le serveur lancé, la documentation interactive est disponible sur `http://localhost:8000/docs`.

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/api/account` | Solde et equity du compte |
| GET | `/api/positions` | Positions ouvertes |
| GET | `/api/bot/status` | Statut du bot (actif/arrêté) |
| POST | `/api/bot/start` | Démarrer le bot |
| POST | `/api/bot/stop` | Arrêter le bot |
| GET | `/api/config` | Configuration active |
| GET | `/api/logs` | Derniers logs (REST) |
| WS | `/ws/logs` | Logs en temps réel |
| WS | `/ws/metrics` | Métriques compte en temps réel |

---

## Avertissement

Ce projet est développé à des fins **éducatives et expérimentales**. Le trading algorithmique comporte des risques financiers significatifs. Ne jamais utiliser ce bot avec du capital réel sans avoir pleinement compris son fonctionnement et testé extensivement en paper trading.

Les performances passées (backtesting) ne garantissent pas les performances futures.

---

## Licence

MIT — voir [LICENSE](LICENSE)

---

<p align="center">Fait avec passion par <a href="https://github.com/ton-username">Mathéo</a> • La Réunion 🌋</p>
