# 🛰️ Remotivity — Cockpit Mobile & Web pour Instances IA et Code à Distance

Application multiplateforme (**Android APK natif via Capacitor + Web/PWA via GitHub Pages**) accompagnée d'un **Agent Hôte Windows 100 % natif PowerShell sans dépendance**, conçue pour accéder, piloter, surveiller et partager simplement vos instances distantes :

- 🤖 **Sessions & Agents IA** : Antigravity IDE, Claude Code CLI, Google Jules
- 💻 **Environnements & Terminaux** : VS Code Server / Tunnels, PowerShell, Bash, SSH Bridge

---

## ✨ Fonctionnalités Principales

1. **📡 Dashboard Multi-Instances en Temps Réel**
   - Vue unifiée de toutes vos machines, sessions Antigravity, agents Claude Code, tâches Jules et tunnels VS Code.
   - Ping temps réel (latence en ms), statut (`En ligne`, `Occupé`, `Hors ligne`), favoris et filtres instantanés.

2. **🖥️ Cockpit d'Accès Distant (`InstanceConsoleModal`)**
   - **Mode Chat / Prompt IA** : Envoyez des prompts directement à vos sessions distantes et déclenchez des actions rapides (*Statut Git*, *Lancer les tests*, *Résumer la session*, *Lister les fichiers*, *Build & Push*).
   - **Mode Terminal Interactif** : Exécution de commandes en direct via l'Agent Hôte PC (`POST /api/exec`) avec chronométrage et historique persistant.
   - **Explorateur de Sessions & Workspaces** : Inspection des conversations actives (`.gemini/antigravity/brain`), projets récents et ressources système de la machine hôte.

3. **🔗 Double Système de Partage (`ShareModal`)**
   - **Partager l'application** : QR Code haute définition, partage natif mobile (`navigator.share`), copie en 1 clic, WhatsApp, Telegram, SMS, X (Twitter), Email, lien direct APK & PWA.
   - **Partager l'accès à une instance** : Générez un **QR Code d'invitation** ou un **lien profond `?invite=...`** pour une instance donnée en choisissant les permissions (*Lecture seule* ou *Contrôle complet*) et la durée de validité (*1h*, *24h*, *7j*, *Permanent*). Importation directe par scan, lien ou code.

4. **🚀 Pop-up Automatique de Mise à Jour (`UpdateModal`)**
   - Au démarrage, Remotivity interroge `https://api.github.com/repos/heyhacene/Remotivity/releases/latest`.
   - Dès qu'une version plus récente est publiée, une pop-up élégante affiche les notes de version et le bouton de téléchargement direct de `Remotivity.apk`, doublée d'une notification locale Android.

5. **⚡ Agent Hôte PC Clé en Main (`host-agent/Start-RemotivityHost.ps1`)**
   - 100 % natif Windows PowerShell (.NET `HttpListener`), **zéro installation requise** (ni Node.js, ni Python).
   - Détecte automatiquement les processus Antigravity / Claude / VS Code et les sessions récentes dans `.gemini\antigravity\brain`.
   - Protégé par jeton aléatoire ou personnalisé, avec affichage automatique du lien d'appairage LAN / Tailscale.

---

## 🚀 Démarrage Rapide de l'Agent Hôte PC

Sur votre PC Windows :

```powershell
powershell -ExecutionPolicy Bypass -File .\host-agent\Start-RemotivityHost.ps1
```

Options utiles :
- `-Port 7890` : Port d'écoute (défaut `7890`)
- `-Token "mon-secret"` : Définir un jeton d'accès fixe (sinon généré automatiquement)
- `-BindAll` : Écouter sur toutes les interfaces réseau (`+`, LAN / Tailscale / WireGuard ; peut demander une élévation ou règle `netsh`)

L'agent affiche directement l'URL locale/Tailscale, le jeton d'accès et le lien d'invitation à importer dans Remotivity sur votre téléphone.

---

## 📱 Installation Mobile (Android) & Web (PWA)

- **APK Android signé** : Disponible dans [GitHub Releases (Latest)](https://github.com/heyhacene/Remotivity/releases/latest) (`Remotivity.apk`).
- **Web / PWA** : Accessible directement depuis [https://heyhacene.github.io/Remotivity/](https://heyhacene.github.io/Remotivity/).

---

## 🛠️ Stack & CI/CD

- **Frontend** : React 19 + TypeScript + Vite + Tailwind CSS v4
- **Mobile Natif** : Capacitor Android 8.5.3 (`com.heyhacene.remotivity`) avec `@capacitor/local-notifications` et `@capacitor/app`
- **CI/CD** : GitHub Actions (`.github/workflows/build-apk.yml`) compilant automatiquement la PWA, générant l'APK release signé et aligné (`Remotivity.apk`), publiant la Release GitHub et déployant sur GitHub Pages à chaque push sur `main`.
