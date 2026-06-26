const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// On s'assure que le dossier existe (utile sur Railway avec un volume monté)
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'bot.sqlite');

// node:sqlite est le module SQLite natif de Node.js (intégré depuis Node 22).
// Avantage majeur par rapport à better-sqlite3 : aucune compilation native
// nécessaire (pas de Visual Studio Build Tools, pas de node-gyp), donc zéro
// souci d'installation sur Windows, Mac ou Railway.
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');

// ---------------------------------------------------------------------------
// TABLE: tickets
// Garde une trace des tickets ouverts pour pouvoir les retrouver / fermer.
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL
  )
`);

// ---------------------------------------------------------------------------
// TABLE: pending_verifications
// Stocke le code captcha envoyé en DM, en attente de réponse.
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS pending_verifications (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    code TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  )
`);

// ---------------------------------------------------------------------------
// TABLE: giveaways
// Tout ce qu'il faut pour gérer un giveaway en cours puis le tirer au sort.
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners_count INTEGER NOT NULL DEFAULT 1,
    host_id TEXT NOT NULL,
    end_at INTEGER NOT NULL,
    ended INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS giveaway_entries (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id)
  )
`);

// ---------------------------------------------------------------------------
// TABLE: twitch_streamers
// Liste des streamers suivis + leur dernier état connu (pour éviter le spam).
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS twitch_streamers (
    login TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    is_live INTEGER NOT NULL DEFAULT 0,
    last_stream_id TEXT DEFAULT NULL
  )
`);

module.exports = db;
