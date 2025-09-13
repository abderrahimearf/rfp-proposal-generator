# coding: utf-8
# Fichier : train_semantic_transformer.py

import os
import random
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.svm import LinearSVC
from sklearn.metrics import classification_report, accuracy_score
from sentence_transformers import SentenceTransformer

print("--- DÉBUT DU SCRIPT D'ENTRAÎNEMENT AVEC EMBEDDINGS SÉMANTIQUES ---")

# --- Données ---
# Le jeu de données reste le même
D=[
  { "texte": "Fondée en 2008, la société opère sur trois continents.", "classe": "entreprise_et_references" },
  { "texte": "Nous sommes partenaires technologiques Gold de Microsoft et Premier d'AWS.", "classe": "entreprise_et_references" },
  { "texte": "Notre département R&D publie régulièrement des livres blancs sur la cybersécurité.", "classe": "entreprise_et_references" },
  { "texte": "Le groupe totalise 1200 projets livrés dans les secteurs public et privé.", "classe": "entreprise_et_references" },
  { "texte": "Nos centres de services sont certifiés ITIL v4 et CMMI niveau 3.", "classe": "entreprise_et_references" },
  { "texte": "Parmi nos réussites : déploiement d’un CRM pour un opérateur télécom national.", "classe": "entreprise_et_references" },
  { "texte": "Notre indice de satisfaction client (NPS) atteint +52 sur les 24 derniers mois.", "classe": "entreprise_et_references" },
  { "texte": "Le capital de l’entreprise est détenu à 100% par ses fondateurs et employés.", "classe": "entreprise_et_references" },
  { "texte": "Nous animons une communauté open-source de 10 000 utilisateurs.", "classe": "entreprise_et_references" },
  { "texte": "Récompensée par le label French Tech, l’entreprise accélère son développement.", "classe": "entreprise_et_references" },
  { "texte": "Nos consultants possèdent des certifications avancées comme PMP, Scrum Master et TOGAF.", "classe": "entreprise_et_references" },
  { "texte": "Des références significatives dans la santé, l’énergie et l’industrie 4.0.", "classe": "entreprise_et_references" },
  { "texte": "Notre équipe est composée de 50 ingénieurs et 10 docteurs en informatique.", "classe": "entreprise_et_references" },
  { "texte": "L'entreprise a été primée au salon VivaTech pour son innovation en IA.", "classe": "entreprise_et_references" },
  { "texte": "Avec un chiffre d'affaires de 25M€ en 2024, notre croissance est solide.", "classe": "entreprise_et_references" },
  { "texte": "Nous avons accompagné avec succès la transformation numérique du groupe BTP Martin.", "classe": "entreprise_et_references" },
  { "texte": "Notre expertise est régulièrement citée dans des publications comme Le Monde Informatique.", "classe": "entreprise_et_references" },
  { "texte": "La société possède la certification ISO 27001, garantissant la sécurité des données.", "classe": "entreprise_et_references" },
  { "texte": "Nous comptons parmi nos clients fidèles des acteurs majeurs du CAC40.", "classe": "entreprise_et_references" },
  { "texte": "Notre siège social est situé à Lyon, avec des agences à Nantes et Bordeaux.", "classe": "entreprise_et_references" },
  { "texte": "Depuis plus de 15 ans, nous développons des solutions logicielles sur mesure.", "classe": "entreprise_et_references" },
  { "texte": "Le taux de rétention de nos employés est de 92%, un gage de stabilité.", "classe": "entreprise_et_references" },
  { "texte": "Nous nous engageons dans une démarche RSE avec un bilan carbone neutre.", "classe": "entreprise_et_references" },
  { "texte": "Notre expertise couvre les technologies Java, Python, et les plateformes cloud.", "classe": "entreprise_et_references" },
  { "texte": "Une étude de cas détaillée sur notre projet avec la Mutuelle Générale est disponible.", "classe": "entreprise_et_references" },
  { "texte": "Nous sommes également partenaires certifiés de Salesforce et Google Cloud Platform.", "classe": "entreprise_et_references" },
  { "texte": "Notre croissance annuelle moyenne s'est élevée à 20% sur les trois dernières années.", "classe": "entreprise_et_references" },
  { "texte": "L'entreprise est lauréate du prix 'Great Place to Work' depuis 5 années consécutives.", "classe": "entreprise_et_references" },
  { "texte": "Plus de 200 experts techniques composent nos effectifs à travers l'Europe.", "classe": "entreprise_et_references" },
  { "texte": "Nous investissons 15% de notre chiffre d'affaires annuel en Recherche et Développement.", "classe": "entreprise_et_references" },
  { "texte": "La satisfaction de nos clients est confirmée par un taux de renouvellement de contrat de 95%.", "classe": "entreprise_et_references" },
  { "texte": "Nos méthodologies sont auditées et certifiées conformes aux standards ISO 9001.", "classe": "entreprise_et_references" },
  { "texte": "Notre portefeuille de clients inclut des leaders mondiaux de l'aéronautique et de la finance.", "classe": "entreprise_et_references" },
  { "texte": "Nous avons mené à bien plus de 50 projets de migration vers le cloud public.", "classe": "entreprise_et_references" },
  { "texte": "Notre organisme de formation interne est certifié Qualiopi.", "classe": "entreprise_et_references" },
  { "texte": "Le client veut centraliser les données produits dispersées entre plusieurs outils.", "classe": "besoin_client" },
  { "texte": "L’organisation a exprimé le besoin d'un portail unique pour les interactions internes.", "classe": "besoin_client" },
  { "texte": "La direction demande des tableaux de bord en temps réel pour piloter l'activité commerciale.", "classe": "besoin_client" },
  { "texte": "Le système actuel ne supporte pas la montée en charge prévue pour les 2 prochaines années.", "classe": "besoin_client" },
  { "texte": "Le client recherche une expérience utilisateur (UX) unifiée sur mobile et desktop.", "classe": "besoin_client" },
  { "texte": "Une intégration fluide avec l’ERP SAP existant est un prérequis indispensable.", "classe": "besoin_client" },
  { "texte": "Les équipes métiers souhaitent une réduction significative du temps de traitement des demandes.", "classe": "besoin_client" },
  { "texte": "Le besoin principal inclut la gestion fine des habilitations et des profils d'accès.", "classe": "besoin_client" },
  { "texte": "La future solution doit impérativement fonctionner en mode déconnecté pour les agents terrain.", "classe": "besoin_client" },
  { "texte": "La DSI exige un plan de réversibilité clair et documenté en fin de contrat.", "classe": "besoin_client" },
  { "texte": "Les filiales internationales imposent une interface multilingue (français, anglais, espagnol).", "classe": "besoin_client" },
  { "texte": "Le client veut réduire le taux d’erreurs de saisie manuel de 30% minimum.", "classe": "besoin_client" },
  { "texte": "L'enjeu majeur est d'améliorer la collaboration inter-départementale.", "classe": "besoin_client" },
  { "texte": "Une contrainte forte est la mise en conformité avec la réglementation sectorielle XYZ avant juin.", "classe": "besoin_client" },
  { "texte": "L'objectif final est l'automatisation des processus manuels chronophages et source d'erreurs.", "classe": "besoin_client" },
  { "texte": "L'entreprise cherche à obtenir une vue consolidée à 360 degrés de son portefeuille clients.", "classe": "besoin_client" },
  { "texte": "Le périmètre budgétaire alloué par le comité de direction ne doit pas être dépassé.", "classe": "besoin_client" },
  { "texte": "L'infrastructure actuelle est jugée obsolète et engendre des coûts de maintenance prohibitifs.", "classe": "besoin_client" },
  { "texte": "Il est critique de pouvoir offrir un espace personnel sécurisé et accessible 24/7.", "classe": "besoin_client" },
  { "texte": "Le principal point de douleur est la lenteur du système actuel aux heures de pointe.", "classe": "besoin_client" },
  { "texte": "La problématique est de garantir la traçabilité complète des opérations logistiques.", "classe": "besoin_client" },
  { "texte": "Le sponsor du projet attend une amélioration mesurable de la productivité des équipes.", "classe": "besoin_client" },
  { "texte": "Il n'existe actuellement aucun outil de reporting fiable pour la direction générale.", "classe": "besoin_client" },
  { "texte": "La solution doit pouvoir s'interfacer avec une dizaine d'applications tierces.", "classe": "besoin_client" },
  { "texte": "L'un des défis est de rendre les employés plus autonomes dans l'accès à l'information.", "classe": "besoin_client" },
  { "texte": "Le département marketing a besoin d'outils pour segmenter plus finement la base de contacts.", "classe": "besoin_client" },
  { "texte": "La direction financière exige que la nouvelle solution réduise les coûts opérationnels de 15%.", "classe": "besoin_client" },
  { "texte": "Un impératif est d'assurer la conformité avec le RGPD pour toutes les données clients.", "classe": "besoin_client" },
  { "texte": "Le service client se plaint de la complexité des outils actuels et du manque d'intégration.", "classe": "besoin_client" },
  { "texte": "Il est nécessaire d'améliorer le 'time-to-market' pour le lancement de nouveaux produits.", "classe": "besoin_client" },
  { "texte": "La migration des systèmes legacy vers une architecture moderne est devenue une priorité absolue.", "classe": "besoin_client" },
  { "texte": "Le client souhaite mettre en place une gouvernance des données plus stricte.", "classe": "besoin_client" },
  { "texte": "La problématique de la dette technique du système existant doit être résolue.", "classe": "besoin_client" },
  { "texte": "L'objectif est de personnaliser le parcours client de bout en bout.", "classe": "besoin_client" },
  { "texte": "Les utilisateurs réclament une fonctionnalité de recherche performante et intuitive.", "classe": "besoin_client" },
  { "texte": "Nous proposons de mettre en place une plateforme modulaire basée sur des microservices.", "classe": "solution_proposee" },
  { "texte": "La solution envisagée intègre un moteur d'IA pour la classification automatique des documents.", "classe": "solution_proposee" },
  { "texte": "Un bus d'intégration de type ESB (API REST/SOAP) exposera les fonctions clés à l'écosystème.", "classe": "solution_proposee" },
  { "texte": "Nous fournirons un kit de migration complet avec scripts d'extraction et de déduplication.", "classe": "solution_proposee" },
  { "texte": "Des tests de performance et de sécurité seront automatisés dans la pipeline CI/CD.", "classe": "solution_proposee" },
  { "texte": "Un dispositif de supervision et de monitoring 24/7 (Datadog) garantira la disponibilité.", "classe": "solution_proposee" },
  { "texte": "Un module RGPD dédié gérera l'anonymisation, le consentement et la purge des données.", "classe": "solution_proposee" },
  { "texte": "Des ateliers de co-conception (Design Thinking) impliqueront les utilisateurs finaux dès le sprint 0.", "classe": "solution_proposee" },
  { "texte": "Notre offre inclut un POC (Proof of Concept) de 4 semaines pour valider les hypothèses.", "classe": "solution_proposee" },
  { "texte": "La restitution des données se fera via un datalake couplé à un outil de BI comme PowerBI.", "classe": "solution_proposee" },
  { "texte": "Un plan d'accompagnement au changement (Change Management) sera déployé dans chaque direction.", "classe": "solution_proposee" },
  { "texte": "L'authentification s'appuiera sur votre annuaire d'entreprise (SSO/AD) avec une option MFA.", "classe": "solution_proposee" },
  { "texte": "L'architecture technique sera de type 'cloud-native', hébergée sur Azure ou GCP.", "classe": "solution_proposee" },
  { "texte": "Notre démarche projet suivra une méthodologie Agile Scrum avec des sprints de trois semaines.", "classe": "solution_proposee" },
  { "texte": "Le projet sera découpé en 3 lots fonctionnels, permettant des mises en production rapides.", "classe": "solution_proposee" },
  { "texte": "Nous mettrons en place une gouvernance projet claire avec un COPIL et un COPROJ.", "classe": "solution_proposee" },
  { "texte": "La stack technique proposée est constituée de React pour le front-end et NodeJS pour le back-end.", "classe": "solution_proposee" },
  { "texte": "Les livrables incluront le code source, la documentation technique et les manuels utilisateurs.", "classe": "solution_proposee" },
  { "texte": "Une phase de recette (UAT) sera menée avec un groupe d'utilisateurs pilotes.", "classe": "solution_proposee" },
  { "texte": "Un support technique de niveau 3 sera assuré par notre équipe de développement.", "classe": "solution_proposee" },
  { "texte": "La solution est conçue pour être hautement scalable et résiliente.", "classe": "solution_proposee" },
  { "texte": "Un plan de formation personnalisé sera élaboré pour les différentes populations d'utilisateurs.", "classe": "solution_proposee" },
  { "texte": "Nous utiliserons un outil de gestion de projet comme Jira pour suivre l'avancement.", "classe": "solution_proposee" },
  { "texte": "Le design de l'interface sera réalisé par nos experts UX/UI en suivant votre charte graphique.", "classe": "solution_proposee" },
  { "texte": "La reprise de l'historique des données sera effectuée durant le premier trimestre.", "classe": "solution_proposee" },
  { "texte": "L'infrastructure sera provisionnée en 'Infrastructure as Code' via Terraform.", "classe": "solution_proposee" },
  { "texte": "Un Data Warehouse sera construit pour consolider les données et permettre l'analyse décisionnelle.", "classe": "solution_proposee" },
  { "texte": "Nous déploierons la solution dans des conteneurs Docker orchestrés par Kubernetes.", "classe": "solution_proposee" },
  { "texte": "Une API Gateway sera mise en place pour gérer la sécurité et le routage des requêtes.", "classe": "solution_proposee" },
  { "texte": "L'approche 'mobile first' guidera la conception de toutes les interfaces utilisateur.", "classe": "solution_proposee" },
  { "texte": "Un 'Product Owner' dédié sera assigné pour maximiser la valeur métier livrée à chaque sprint.", "classe": "solution_proposee" },
  { "texte": "Nous réaliserons des tests de pénétration (pentests) avant chaque mise en production majeure.", "classe": "solution_proposee" },
  { "texte": "Le transfert de compétences vers vos équipes techniques sera assuré tout au long du projet.", "classe": "solution_proposee" },
  { "texte": "Une documentation d'API (Swagger/OpenAPI) sera générée automatiquement.", "classe": "solution_proposee" },
  { "texte": "La solution intégrera un système de gestion de contenu (CMS) headless pour plus de flexibilité.", "classe": "solution_proposee" },
  { "texte": "Le budget récurrent annuel inclut l’hébergement, la maintenance et le support niveau 2.", "classe": "offre_financiere" },
  { "texte": "Une option d'abonnement mensuel (SaaS) sans engagement est disponible pour la phase pilote.", "classe": "offre_financiere" },
  { "texte": "Les coûts d'intégration et de paramétrage sont forfaitisés sur la base du périmètre défini.", "classe": "offre_financiere" },
  { "texte": "Des paliers de remise s'appliquent sur le prix des licences au-delà de 500 utilisateurs.", "classe": "offre_financiere" },
  { "texte": "Notre devis distingue clairement les dépenses d'investissement (CAPEX) et d'exploitation (OPEX).", "classe": "offre_financiere" },
  { "texte": "Les déplacements et frais de vie sont facturés au réel sur présentation de justificatifs.", "classe": "offre_financiere" },
  { "texte": "Le coût de la Tierce Maintenance Applicative (TMA) est basé sur un volume de jours/homme.", "classe": "offre_financiere" },
  { "texte": "Un escompte de 2% est appliqué pour tout paiement comptant à 15 jours.", "classe": "offre_financiere" },
  { "texte": "Le plan de facturation suivra les jalons : 40% au kick-off, 40% à la recette, 20% à la mise en prod.", "classe": "offre_financiere" },
  { "texte": "Le modèle tarifaire est basé sur un coût par utilisateur actif par mois.", "classe": "offre_financiere" },
  { "texte": "Les tarifs sont exprimés en euros hors taxes (HT) et sont révisables annuellement.", "classe": "offre_financiere" },
  { "texte": "Toute demande hors périmètre fera l'objet d'un chiffrage additionnel via un avenant.", "classe": "offre_financiere" },
  { "texte": "L'enveloppe budgétaire globale pour ce projet s'élève à 250k€.", "classe": "offre_financiere" },
  { "texte": "Le Taux Journalier Moyen (TJM) de nos consultants seniors est de 900 euros.", "classe": "offre_financiere" },
  { "texte": "Cette proposition commerciale est valable 90 jours à compter de sa date d'émission.", "classe": "offre_financiere" },
  { "texte": "Le coût total de possession (TCO) sur 5 ans est estimé pour faciliter votre décision.", "classe": "offre_financiere" },
  { "texte": "Les conditions de paiement standard sont à 45 jours fin de mois par virement.", "classe": "offre_financiere" },
  { "texte": "Le chiffrage détaillé des différentes options est présenté dans l'annexe financière.", "classe": "offre_financiere" },
  { "texte": "Le prix de la licence logicielle est dégressif en fonction du volume.", "classe": "offre_financiere" },
  { "texte": "Un acompte de 30% du montant total est requis à la signature du bon de commande.", "classe": "offre_financiere" },
  { "texte": "Le prix n'inclut pas les licences logicielles tierces (ex: base de données Oracle).", "classe": "offre_financiere" },
  { "texte": "La facturation sera émise mensuellement sur la base des consommations réelles.", "classe": "offre_financiere" },
  { "texte": "Le montant forfaitaire de la phase de cadrage est de 15 000 € HT.", "classe": "offre_financiere" },
  { "texte": "Aucun frais supplémentaire ne sera appliqué sans votre accord préalable écrit.", "classe": "offre_financiere" },
  { "texte": "Cette offre représente un investissement initial de 120k€ et un coût de fonctionnement de 30k€/an.", "classe": "offre_financiere" },
  { "texte": "Les coûts de formation des utilisateurs sont inclus dans cette proposition.", "classe": "offre_financiere" },
  { "texte": "Le tarif de support premium offrant un GTR de 4h est disponible en option.", "classe": "offre_financiere" },
  { "texte": "Une redevance annuelle de maintenance de 18% du prix des licences sera appliquée à partir de la deuxième année.", "classe": "offre_financiere" },
  { "texte": "Le budget alloué à la reprise de données est estimé à 20 jours/homme.", "classe": "offre_financiere" },
  { "texte": "Les prix seront indexés annuellement sur l'indice Syntec.", "classe": "offre_financiere" },
  { "texte": "Ce chiffrage est basé sur une hypothèse de 10 interfaces à développer.", "classe": "offre_financiere" },
  { "texte": "Le coût de l'hébergement cloud sera refacturé à l'euro près, sans marge.", "classe": "offre_financiere" },
  { "texte": "Un paiement échelonné sur 12 mois est possible, sous réserve d'acceptation du dossier.", "classe": "offre_financiere" },
  { "texte": "La phase de 'Proof of Concept' est proposée à un tarif préférentiel de 25k€.", "classe": "offre_financiere" },
  { "texte": "Le devis ne comprend pas l'achat de matériel hardware spécifique.", "classe": "offre_financiere" },
  { "texte": "Un avenant contractuel sera nécessaire pour toute extension de périmètre validée en COPIL.", "classe": "cadre_contractuel" },
  { "texte": "Notre clause de Service Level Agreement (SLA) définit un taux de disponibilité de 99,9%.", "classe": "cadre_contractuel" },
  { "texte": "Les données du client resteront hébergées dans l'Union Européenne (datacenter en Irlande).", "classe": "cadre_contractuel" },
  { "texte": "Le prestataire s'engage à une restitution complète des données dans un format standard et ouvert.", "classe": "cadre_contractuel" },
  { "texte": "Une charte de sécurité stricte encadre les accès administrateurs et les audits réguliers.", "classe": "cadre_contractuel" },
  { "texte": "La liste des sous-traitants autorisés est fournie en annexe avec leur niveau de conformité.", "classe": "cadre_contractuel" },
  { "texte": "La durée initiale du présent contrat est fixée à 36 mois, renouvelable par tacite reconduction.", "classe": "cadre_contractuel" },
  { "texte": "La résiliation du contrat peut intervenir pour manquement grave après une mise en demeure.", "classe": "cadre_contractuel" },
  { "texte": "La politique de sauvegarde (backup) et le Plan de Reprise d'Activité (PRA) sont détaillés.", "classe": "cadre_contractuel" },
  { "texte": "Les obligations et le coût de la réversibilité s'appliquent en fin de contrat.", "classe": "cadre_contractuel" },
  { "texte": "La gestion des incidents de production suit un processus ITIL avec une priorisation de P1 à P4.", "classe": "cadre_contractuel" },
  { "texte": "Un Data Processing Agreement (DPA) sera signé pour encadrer le traitement des données personnelles.", "classe": "cadre_contractuel" },
  { "texte": "La propriété intellectuelle des développements spécifiques réalisés pour le client lui sera transférée.", "classe": "cadre_contractuel" },
  { "texte": "Chaque partie s'engage à une obligation de confidentialité absolue concernant ce projet.", "classe": "cadre_contractuel" },
  { "texte": "Le contrat est soumis au droit français et le Tribunal de Commerce de Paris sera seul compétent.", "classe": "cadre_contractuel" },
  { "texte": "Les attestations d'assurance en responsabilité civile professionnelle sont jointes au dossier.", "classe": "cadre_contractuel" },
  { "texte": "Les pénalités de retard en cas de non-respect des délais sont plafonnées à 5% du montant total.", "classe": "cadre_contractuel" },
  { "texte": "Le client garantit détenir tous les droits sur les contenus qu'il fournira.", "classe": "cadre_contractuel" },
  { "texte": "Les modalités de recette provisoire et définitive sont décrites dans le Plan d'Assurance Qualité.", "classe": "cadre_contractuel" },
  { "texte": "En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute action en justice.", "classe": "cadre_contractuel" },
  { "texte": "La présente convention entre en vigueur à la date de sa signature par les deux parties.", "classe": "cadre_contractuel" },
  { "texte": "Le non-respect du GTR (Garantie de Temps de Rétablissement) entraîne l'application de pénalités.", "classe": "cadre_contractuel" },
  { "texte": "Le prestataire s'interdit de débaucher le personnel du client pendant la durée du contrat.", "classe": "cadre_contractuel" },
  { "texte": "Les conditions générales de vente prévalent sur tout autre document.", "classe": "cadre_contractuel" },
  { "texte": "Le client est responsable de la désignation d'un chef de projet interne disponible.", "classe": "cadre_contractuel" },
  { "texte": "Un accord de non-divulgation (NDA) devra être signé par toutes les parties prenantes.", "classe": "cadre_contractuel" },
  { "texte": "La propriété du code générique et des briques logicielles préexistantes reste celle du prestataire.", "classe": "cadre_contractuel" },
  { "texte": "Aucune des parties ne pourra être tenue responsable en cas de force majeure.", "classe": "cadre_contractuel" },
  { "texte": "Le client dispose d'un droit d'audit annuel des infrastructures et des processus de sécurité.", "classe": "cadre_contractuel" },
  { "texte": "Toute cession du contrat à un tiers est soumise à l'accord écrit préalable de l'autre partie.", "classe": "cadre_contractuel" },
  { "texte": "Le prestataire garantit la conformité de la solution aux réglementations en vigueur.", "classe": "cadre_contractuel" },
  { "texte": "Le contrat peut être résilié par l'une ou l'autre des parties avec un préavis de 3 mois.", "classe": "cadre_contractuel" },
  { "texte": "Le Plan d'Assurance Sécurité (PAS) décrit l'ensemble des mesures de protection mises en œuvre.", "classe": "cadre_contractuel" },
  { "texte": "La responsabilité du prestataire est limitée au montant total du contrat.", "classe": "cadre_contractuel" },
  { "texte": "Le client s'engage à fournir les données et validations nécessaires dans les délais convenus.", "classe": "cadre_contractuel" },
  { "texte": "En conclusion, la feuille de route proposée est à la fois ambitieuse, réaliste et mesurable.", "classe": "synthese" },
  { "texte": "La solution apportera un Retour sur Investissement (ROI) rapide via l'automatisation.", "classe": "synthese" },
  { "texte": "Les indicateurs clés de succès (KPIs) incluront le taux d'adoption et la satisfaction utilisateur.", "classe": "synthese" },
  { "texte": "Nous recommandons de démarrer par un pilote limité pour sécuriser le déploiement global.", "classe": "synthese" },
  { "texte": "Les bénéfices attendus couvrent la qualité de service, la productivité et la conformité.", "classe": "synthese" },
  { "texte": "Notre dispositif d'accompagnement garantit une montée en compétence rapide de vos équipes.", "classe": "synthese" },
  { "texte": "Les principales dépendances identifiées concernent l'ERP et l'annuaire d'entreprise.", "classe": "synthese" },
  { "texte": "Notre proposition se distingue de la concurrence par sa modularité et son faible coût de possession.", "classe": "synthese" },
  { "texte": "Un comité de pilotage mensuel assurera l'alignement stratégique constant du projet.", "classe": "synthese" },
  { "texte": "Le planning cible une mise en production progressive par lot fonctionnel au cours de l'année.", "classe": "synthese" },
  { "texte": "Un plan de mitigation des risques a été intégré pour anticiper les éventuels problèmes.", "classe": "synthese" },
  { "texte": "Globalement, notre offre maximise la valeur métier tout en minimisant les risques techniques.", "classe": "synthese" },
  { "texte": "En résumé, notre partenariat vous offre l'assurance d'un projet mené à bien.", "classe": "synthese" },
  { "texte": "L'avantage majeur de notre approche réside dans sa flexibilité et son évolutivité.", "classe": "synthese" },
  { "texte": "Les prochaines étapes consisteraient à organiser un atelier de cadrage avec les parties prenantes.", "classe": "synthese" },
  { "texte": "En somme, ce projet est une opportunité unique de moderniser votre système d'information.", "classe": "synthese" },
  { "texte": "La valeur ajoutée de notre solution est sa capacité à s'adapter à vos futurs besoins.", "classe": "synthese" },
  { "texte": "Nous sommes convaincus que notre collaboration sera un facteur clé de votre succès futur.", "classe": "synthese" },
  { "texte": "Les points forts de cette proposition sont sans conteste la robustesse et la sécurité.", "classe": "synthese" },
  { "texte": "Pour conclure, nous restons à votre entière disposition pour toute question ou clarification.", "classe": "synthese" },
  { "texte": "Le principal différentiateur de notre offre est notre expertise métier reconnue dans votre secteur.", "classe": "synthese" },
  { "texte": "Nous vous suggérons de planifier une séance de démonstration de la solution.", "classe": "synthese" },
  { "texte": "Notre conviction est que ce projet aura un impact positif et durable sur votre organisation.", "classe": "synthese" },
  { "texte": "Finalement, le choix de notre solution est un investissement stratégique pour l'avenir.", "classe": "synthese" },
  { "texte": "Nous sommes prêts à nous engager à vos côtés pour faire de ce projet une réussite commune.", "classe": "synthese" },
  { "texte": "Pour résumer, notre offre combine expertise technique et compréhension approfondie de vos enjeux.", "classe": "synthese" },
  { "texte": "L'adoption de cette plateforme se traduira par des gains de productivité mesurables dès le premier semestre.", "classe": "synthese" },
  { "texte": "Nous préconisons une approche par étapes pour maîtriser les risques et maximiser l'adhésion.", "classe": "synthese" },
  { "texte": "Ce projet structurant vous donnera un avantage concurrentiel significatif.", "classe": "synthese" },
  { "texte": "En définitive, nous vous apportons bien plus qu'un outil : un véritable partenariat pour votre transformation.", "classe": "synthese" },
  { "texte": "La prochaine étape serait de vous présenter notre chef de projet et de planifier le 'kick-off'.", "classe": "synthese" },
  { "texte": "Le succès de ce projet repose sur une collaboration étroite que nous nous engageons à garantir.", "classe": "synthese" },
  { "texte": "Notre solution se démarque par une expérience utilisateur soignée, gage d'une adoption réussie.", "classe": "synthese" },
  { "texte": "Nous avons la certitude que cette proposition répond en tous points à votre cahier des charges.", "classe": "synthese" },
  { "texte": "En un mot, ce projet est une fondation solide pour votre croissance future.", "classe": "synthese" }
]

# --- Configuration et Préparation ---
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

df = pd.DataFrame(D)
X = df['texte']
y = df['classe']


print("Chargement du modèle Sentence Transformer (cela peut prendre un moment)...")

encoder_model = SentenceTransformer('distiluse-base-multilingual-cased-v1')
print("Modèle chargé.")

# --- ÉTAPE 2: Création des embeddings sémantiques pour tout le dataset ---
# Nous transformons chaque phrase en un vecteur numérique de sens.
print("Création des embeddings pour les textes...")

X_embeddings = encoder_model.encode(X.tolist(), show_progress_bar=True)
print(f"Les textes ont été transformés en vecteurs de dimension {X_embeddings.shape[1]}.")

# --- ÉTAPE 3: Entraînement du classifieur sur les embeddings ---
# Nous utilisons maintenant les embeddings comme "features" pour le SVM.
# La logique est la même qu'avant, mais les données d'entrée sont bien plus riches.
X_train, X_test, y_train, y_test = train_test_split(
    X_embeddings, y, test_size=0.25, random_state=SEED, stratify=y
)

print("\nEntraînement du classifieur SVM sur les embeddings...")
# Un LinearSVC est très efficace sur ce type de données denses.
# On peut augmenter 'max_iter' si le modèle ne converge pas.
classifier = LinearSVC(random_state=SEED, dual="auto", C=1.0, max_iter=2000)
classifier.fit(X_train, y_train)
print("Entraînement terminé.")

# --- ÉTAPE 4: Évaluation finale ---
y_pred = classifier.predict(X_test)
print("\n=== Évaluation finale sur le jeu de test (hold-out) ===")
print(f"Accuracy: {accuracy_score(y_test, y_pred):.3f}")
print("\nRapport de classification détaillé:")
print(classification_report(y_test, y_pred))

# --- ÉTAPE 5: Sauvegarde du pipeline complet (encoder + classifieur) ---
# Pour utiliser ce modèle en production, il faut sauvegarder les deux parties.
# On peut les mettre dans un dictionnaire ou une classe custom.

class SemanticPipeline:
    def __init__(self, encoder, classifier):
        self.encoder = encoder
        self.classifier = classifier

    def predict(self, texts):
        # S'assurer que l'input est une liste de strings
        if isinstance(texts, str):
            texts = [texts]
        
        embeddings = self.encoder.encode(texts)
        return self.classifier.predict(embeddings)

# Création de l'objet pipeline
full_pipeline = SemanticPipeline(encoder_model, classifier)

# Sauvegarde
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
except NameError:
    script_dir = "."
    
model_path = os.path.join(script_dir, "svm_semantic_pipeline_final.joblib")
joblib.dump(full_pipeline, model_path)
print(f"\nPipeline sémantique complet sauvegardé : {model_path}")

# --- Exemple de chargement et d'utilisation ---
print("\n--- Test de chargement et de prédiction ---")
loaded_pipeline = joblib.load(model_path)
test_sentence = "Le client a besoin d'un reporting plus efficace."
prediction = loaded_pipeline.predict([test_sentence])
print(f"La phrase : '{test_sentence}'")
print(f"Prédiction : '{prediction[0]}'")

print("\n--- FIN DU SCRIPT D'ENTRAÎNEMENT ---")