# clear_weaviate.py
import os
import weaviate
from weaviate.auth import AuthApiKey
from dotenv import load_dotenv
import warnings

# ==============================================================================
# ATTENTION : Ce script est destructif.
# Il va se connecter à votre instance Weaviate Cloud et supprimer TOUTES
# les collections (données et schémas) qui s'y trouvent.
#
# L'opération est IRRÉVERSIBLE.
# ==============================================================================

# Ignorer les avertissements de dépréciation pour un affichage propre
warnings.filterwarnings("ignore", category=DeprecationWarning)

def clear_all_weaviate_collections():
    """
    Se connecte à Weaviate et supprime toutes les collections après confirmation.
    """
    # 1. Charger la configuration depuis le fichier .env
    load_dotenv()
    weaviate_url = os.getenv("WEAVIATE_URL")
    weaviate_api_key = os.getenv("WEAVIATE_API_KEY")

    if not weaviate_url or not weaviate_api_key:
        print("ERREUR : Les variables WEAVIATE_URL et WEAVIATE_API_KEY sont introuvables.")
        print("Veuillez les définir dans votre fichier .env.")
        return

    client = None
    try:
        # 2. Se connecter au client Weaviate
        print(f"Connexion au cluster Weaviate : {weaviate_url}")
        client = weaviate.connect_to_weaviate_cloud(
            cluster_url=weaviate_url,
            auth_credentials=AuthApiKey(api_key=weaviate_api_key),
        )

        if not client.is_ready():
            print("ERREUR : La connexion au cluster Weaviate a échoué.")
            return

        # 3. Lister toutes les collections existantes
        collections = client.collections.list_all()

        if not collections:
            print("\nAucune collection trouvée sur ce cluster. Rien à faire.")
            return

        print("\nCollections qui seront DÉFINITIVEMENT supprimées :")
        for name in collections.keys():
            print(f"  - {name}")

        # 4. Étape de confirmation critique pour éviter les accidents
        print("\n-------------------------------------------------------------")
        print("ATTENTION : Cette action est irréversible.")
        confirmation = input(
            "Pour confirmer, veuillez taper exactement 'OUI-SUPPRIMER-TOUT' puis appuyez sur Entrée : "
        )
        print("-------------------------------------------------------------")

        if confirmation.strip() != "OUI-SUPPRIMER-TOUT":
            print("\nConfirmation incorrecte. Opération annulée.")
            return

        # 5. Boucle de suppression
        print("\nConfirmation reçue. Début de la suppression...")
        for name in collections.keys():
            try:
                client.collections.delete(name)
                print(f"  - Collection '{name}' supprimée avec succès.")
            except Exception as e:
                print(f"  - ERREUR lors de la suppression de '{name}': {e}")
        
        print("\nToutes les collections ont été supprimées.")

    except Exception as e:
        print(f"\nUne erreur inattendue est survenue : {e}")

    finally:
        # 6. Fermer la connexion proprement
        if client:
            client.close()
            print("\nConnexion à Weaviate fermée.")


if __name__ == "__main__":
    clear_all_weaviate_collections()