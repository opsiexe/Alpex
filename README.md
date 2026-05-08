<img width="1672" height="467" alt="alpex-github-banner" src="https://github.com/user-attachments/assets/5fff8173-6668-4a25-97cd-c766a02cd885" />

# Alpex

Bot de trading algorithmique (paper trading) avec API FastAPI, moteur de backtest et frontend React/Vite.

## Fonctionnalités

- Stratégie de croisement de moyennes mobiles.
- Gestion du risque (taille de position, stop/take, limite de positions).
- API pour compte, positions, logs et contrôle du bot.
- Backtest + walk-forward + export de résultats.
- Dashboard frontend.

## Prérequis

- Python 3.11+
- Node.js 20+
- Un compte Alpaca Paper Trading

## Installation

### Backend

```bash
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm ci
```

## Configuration

1. Copier `.env.example` en `.env`
2. Renseigner vos clés Alpaca (paper uniquement)

## Lancement

### API

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Bot scheduler (CLI)

```bash
python main.py
```

### Backtest

```bash
python main_backtest.py
```

### Frontend

```bash
cd frontend
npm run dev
```

## Sécurité

- Ne jamais versionner `.env` ni des clés API.
- Le projet est configuré en `paper=True` côté broker.
- Voir `SECURITY.md` pour la divulgation responsable.

## Licence

Ce projet est sous licence MIT. Voir `LICENSE`.
