# Directives du Projet — Remotivity

## 1. Priorité absolue à l'application (Aucun contournement imposé à l'utilisateur)
- **Ne jamais suggérer d'éviter ou d'abandonner l'application** : Face à un bogue, un plantage, une difficulté d'installation (ex. blocage constructeur Samsung, permissions Android) ou une incompatibilité sur un modèle d'appareil particulier, il est strictement interdit de proposer à l'utilisateur ou à ses testeurs d'abandonner l'application ou d'utiliser une alternative de repli (ex. : « n'installez pas l'appli, allez sur le navigateur », « faites sans l'application »).
- **Résolution obligatoire à la racine dans l'application** : L'assistant doit systématiquement :
  1. Identifier et corriger le code ou la configuration source (événements tactiles, balises natives, gestion réseau `usesCleartextTraffic`, signature d'APK, scripts de compilation et de déploiement).
  2. Fournir des explications techniques directes et des étapes de déblocage claires pour que l'application native elle-même s'installe et s'exécute sans friction.
  3. Considérer l'expérience dans l'application native comme l'unique objectif final acceptable.

## 2. Ergonomie & Philosophie Remotivity
- **Accès immédiat aux instances distantes** : Connexion en un tap aux sessions IA & code (Antigravity, Claude Code, Google Jules, VS Code Server, terminaux PowerShell/Bash) depuis mobile ou web.
- **Partage fluide et sécurisé** : Partage de l'application (QR Code, lien APK direct, PWA) et partage ciblé d'accès à une instance (lien/QR code d'invitation avec choix des droits lecture seule / contrôle complet et expiration).
- **Mises à jour transparentes** : Vérification automatique de la dernière release GitHub au lancement avec pop-up de notification et téléchargement direct de l'APK signé.
