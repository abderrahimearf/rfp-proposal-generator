# backend/backend/api/shared_sessions.py
# -*- coding: utf-8 -*-

# =============================================================================
# MÉMOIRE PARTAGÉE POUR LES SESSIONS D'ORCHESTRATION
# =============================================================================

# Ce dictionnaire agit comme une mémoire centrale et partagée pour les sessions
# de génération actives.
#
# Son fonctionnement est le suivant :
# 1. Le module `api/orchestrator2.py` y ÉCRIT une nouvelle session lorsqu'une
#    génération démarre.
# 2. Le module `api/conversation.py` y LIT une session lorsque la génération
#    est terminée, afin de récupérer le contenu final et de démarrer le chat.
# 3. Une fois la transition vers le chat effectuée, `conversation.py` SUPPRIME
#    la session de ce dictionnaire pour libérer la mémoire.

orchestrator_sessions = {}