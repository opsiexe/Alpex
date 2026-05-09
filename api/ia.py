import os
import json
import re
from google import genai
from google.genai import types
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

MODEL = "gemini-3.1-flash-lite"
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))


def get_complete_trading_analysis(news_list: list):
    if not news_list:
        return {"global_summary": "Aucune news", "news_analysis": []}

    formatted_news = "\n".join([f"ID:{i} | {n.get('title')}" for i, n in enumerate(news_list)])

    prompt = f"""
    En tant qu'analyste financier, analyse ces news :
    {formatted_news}

    Réponds EXCLUSIVEMENT au format JSON suivant :
    {{
      "global_summary": "résumé global ici",
      "news_analysis": [
        {{ "id": 0, "sentiment": "Bullish", "score": 80 }}
      ]
    }}
    """

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                # 1. On force le MIME type au niveau de l'API
                response_mime_type="application/json",
                temperature=0.1
            )
        )

        # 2. Nettoyage de sécurité par Regex au cas où
        raw_text = response.text.strip()
        # Supprime les balises ```json et ``` si elles existent
        clean_json = re.sub(r'^```json\s*|```$', '', raw_text, flags=re.MULTILINE).strip()

        return json.loads(clean_json)

    except Exception as e:
        logger.error(f"Erreur IA : {e} | Texte reçu : {response.text if 'response' in locals() else 'N/A'}")
        return {
            "global_summary": "Erreur de formatage IA.",
            "news_analysis": [{"id": i, "sentiment": "Neutral", "score": 50} for i in range(len(news_list))]
        }


if __name__ == "__main__":
    # Test avec des news réelles
    mock_news = [
        {"title": "NVIDIA dépasse les attentes avec des revenus records dans l'IA"},
        {"title": "Incertitude sur les taux : la Fed pourrait maintenir ses positions"},
        {"title": "Le secteur technologique chute suite aux craintes de régulation"}
    ]

    print("--- TEST DE PARSING JSON ---")
    result = get_complete_trading_analysis(mock_news)

    # Vérification du type de retour
    if isinstance(result, dict):
        print("Succès : L'IA a répondu avec un dictionnaire Python valide.")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print("Échec : La réponse n'est pas un dictionnaire.")