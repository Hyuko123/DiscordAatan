# 🤖 Bot Discord All-in-One

Bot Discord complet avec :
- 🎫 **Système de tickets** (panel + boutons + permissions automatiques)
- ✅ **Vérification par captcha texte en DM** + rôle automatique
- 👋 **Accueil** (messages de bienvenue / départ)
- 📊 **Sondages** (commande `/sondage`)
- 🎉 **Giveaways** (commande `/giveaway`, tirage automatique)
- 🔴 **Notifications de live Twitch** (détection automatique, polling)

Stack : **Node.js + discord.js v14 + node:sqlite (module SQLite natif de Node, zéro compilation)**

---

## 1. Créer l'application Discord

1. Va sur le [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → donne-lui un nom
3. Onglet **Bot** :
   - Clique sur **Reset Token** pour générer le token → copie-le (tu en auras besoin dans `.env`)
   - Active ces 3 options sous **Privileged Gateway Intents** :
     - ✅ `SERVER MEMBERS INTENT` (obligatoire pour l'accueil et les rôles)
     - ✅ `MESSAGE CONTENT INTENT` (obligatoire pour lire les codes captcha en DM)
4. Onglet **OAuth2 > URL Generator** :
   - Scopes : `bot` + `applications.commands`
   - Permissions bot minimum requises :
     - Gérer les rôles
     - Gérer les salons
     - Voir les salons
     - Envoyer des messages
     - Gérer les messages
     - Intégrer des liens (embeds)
     - Joindre des fichiers
     - Lire l'historique des messages
     - Ajouter des réactions
   - Copie l'URL générée en bas de page et ouvre-la pour inviter le bot sur ton serveur

⚠️ **Important** : le rôle du bot doit être placé **au-dessus** des rôles qu'il doit attribuer (rôle vérifié, etc.) dans la hiérarchie des rôles du serveur (Paramètres du serveur > Rôles).

---

## 2. Configuration locale

```bash
git clone <ton-repo>
cd discord-bot
npm install
cp .env.example .env
```

⚠️ **Node.js 22.5.0 minimum requis** (idéalement 22.13+ ou la dernière LTS). Le projet utilise le module `node:sqlite` intégré à Node, donc **aucune compilation native n'est nécessaire** (pas de Visual Studio Build Tools sur Windows, pas de `node-gyp`). Vérifie ta version avec `node -v`.

Remplis le fichier `.env` (voir les commentaires dans `.env.example` pour chaque variable). Les éléments essentiels :

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Token du bot (Developer Portal > Bot) |
| `CLIENT_ID` | Application ID (Developer Portal > General Information) |
| `GUILD_ID` | ID de ton serveur (clic droit dessus en mode développeur) — pour déployer les commandes instantanément en dev |

Active le **mode développeur** Discord (Paramètres > Avancés) pour pouvoir clic-droit > Copier l'identifiant sur les salons/rôles/serveur.

### Déployer les commandes slash

```bash
npm run deploy-commands
```

À refaire chaque fois que tu ajoutes/modifies une commande.

### Lancer le bot

```bash
npm start
```

---

## 3. Mise en place de chaque fonctionnalité

### 🎫 Tickets
1. Crée une catégorie pour les tickets, copie son ID → `TICKET_CATEGORY_ID`
2. Copie l'ID du/des rôle(s) staff → `TICKET_STAFF_ROLE_IDS` (séparés par une virgule)
3. Dans le salon souhaité, tape `/ticket-panel`

### ✅ Vérification (captcha)
1. Crée un rôle "Non vérifié" avec permissions restreintes (ne voit que le salon de vérification) → `UNVERIFIED_ROLE_ID`
2. Crée un rôle "Vérifié" avec accès au reste du serveur → `VERIFIED_ROLE_ID`
3. Dans le salon de vérification, tape `/verify-panel`
4. **Le rôle du bot doit être au-dessus de ces deux rôles** dans la hiérarchie

### 👋 Accueil
- Renseigne `WELCOME_CHANNEL_ID` et/ou `LEAVE_CHANNEL_ID` — rien d'autre à faire, c'est automatique.

### 📊 Sondages
- `/sondage question:"..." option1:"..." option2:"..."` (jusqu'à 5 options)

### 🎉 Giveaways
- `/giveaway duree:10m prix:"Un rôle Booster" gagnants:1`
- Formats de durée acceptés : `30s`, `10m`, `2h`, `1d`

### 🔴 Notification Twitch
1. Crée une app sur https://dev.twitch.tv/console/apps (Redirect URL : `http://localhost`, type : Confidential)
2. Récupère le **Client ID** et génère un **Client Secret** → `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`
3. Renseigne les pseudos Twitch à surveiller → `TWITCH_STREAMERS=pseudo1,pseudo2`
4. Renseigne le salon d'annonce → `TWITCH_ANNOUNCE_CHANNEL_ID`
5. (Optionnel) `TWITCH_PING_ROLE_ID` pour ping un rôle à chaque live

Le bot vérifie le statut toutes les `TWITCH_CHECK_INTERVAL` secondes (60 par défaut).

---

## 4. Déploiement sur Railway

1. Push ce projet sur GitHub
2. Sur [Railway](https://railway.app) : **New Project > Deploy from GitHub repo**
3. Sélectionne ton repo
4. Dans l'onglet **Variables**, ajoute toutes les variables de ton `.env` (Railway les injecte automatiquement comme variables d'environnement)
5. **Important : la persistance de la base SQLite**
   - Par défaut, le système de fichiers de Railway est **éphémère** (remis à zéro à chaque redéploiement)
   - Pour conserver les tickets/giveaways/vérifications entre les déploiements : onglet **Volumes** > crée un volume, monte-le sur `/data`, puis ajoute la variable `DATABASE_PATH=/data/bot.sqlite`
6. Railway détecte automatiquement `npm start` grâce au `package.json` (pas besoin de Dockerfile)
7. **Avant le premier démarrage en prod**, déploie les commandes slash une fois :
   - Soit en local avec les mêmes variables d'env (`npm run deploy-commands`)
   - Soit en lançant temporairement cette commande depuis l'onglet "Deployments > ... > Run command" de Railway

Une fois déployé, le bot tourne en continu et redémarre automatiquement en cas de crash (comportement par défaut de Railway).

---

## 5. Structure du projet

```
src/
├── index.js              # Point d'entrée : connexion Discord + chargement events/commandes
├── deploy-commands.js     # Script pour enregistrer les slash commands auprès de Discord
├── commands/              # Une commande slash par fichier
│   ├── ticket-panel.js
│   ├── verify-panel.js
│   ├── sondage.js
│   ├── giveaway.js
│   └── help.js
├── events/                # Listeners d'événements Discord
│   ├── ready.js
│   ├── interactionCreate.js
│   ├── messageCreate.js
│   ├── guildMemberAdd.js
│   └── guildMemberRemove.js
├── handlers/              # Logique métier réutilisable
│   ├── ticketHandler.js
│   ├── verifyHandler.js
│   ├── giveawayHandler.js
│   └── twitchPoller.js
├── utils/
│   └── twitchApi.js       # Client minimal pour l'API Helix de Twitch
└── database/
    └── db.js              # Schéma et connexion SQLite
```

## 6. Dépannage rapide

- **Le bot ne répond à aucune commande slash** → as-tu lancé `npm run deploy-commands` ? Si déployé globalement, attends jusqu'à 1h.
- **Le bot ne peut pas créer de ticket / attribuer de rôle** → vérifie que son rôle est bien placé au-dessus dans la hiérarchie des rôles, et qu'il a les permissions nécessaires (voir étape 1).
- **Le captcha DM ne fonctionne pas pour un utilisateur** → ses messages privés sont probablement fermés aux membres du serveur (paramètre de confidentialité Discord côté utilisateur, rien à voir avec le bot).
- **Pas de notification Twitch** → vérifie `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET`, et que les pseudos dans `TWITCH_STREAMERS` sont bien en minuscules et correspondent au login (pas au nom d'affichage).
