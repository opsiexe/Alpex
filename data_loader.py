import yfinance as yf
import os
from datetime import datetime

def download_stock_data(ticker, start_date, end_date=None):
    # 1. Définir le chemin du dossier data
    data_dir = "data"
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)

    # 2. Télécharger les données
    print(f"Téléchargement des données pour {ticker}...")
    data = yf.download(ticker, start_date, end_date)

    if data.empty:
        print(f"Aucune trouvée pour {ticker}.")
        return

    # 3. Créer le nom du fichier (ex : data/AAPL_2024-05-07.csv)
    file_name = f"{ticker}_{datetime.now().strftime('%Y-%m-%d')}.csv"
    file_path = os.path.join(data_dir, file_name)

    # 4. sauvegarder en CSV
    data.to_csv(file_path)
    print(f"Données sauvegardées dans : {file_path}")

if __name__ == "__main__":
    download_stock_data("NVDA", start_date="2023-01-01")