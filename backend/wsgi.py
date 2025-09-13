
from waitress import serve


from app import create_app


app = create_app()


if __name__ == '__main__':
    print("--- DÉMARRAGE DU SERVEUR DE PRODUCTION WAITRESS ---")
 
    serve(app, host='127.0.0.1', port=5000, threads=8)