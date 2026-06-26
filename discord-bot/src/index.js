require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

// Validation basique des variables d'environnement critiques au démarrage.
// Mieux vaut planter tout de suite avec un message clair que de crasher
// silencieusement plus tard dans les logs Railway.
const requiredEnv = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[BOOT] Variables d'environnement manquantes: ${missing.join(', ')}`);
  console.error('[BOOT] Copie .env.example vers .env et remplis les valeurs (ou configure les variables sur Railway).');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,       // arrivée/départ membres + rôles
    GatewayIntentBits.GuildMessages,      // lecture messages (sondages, etc.)
    GatewayIntentBits.MessageContent,     // si besoin de lire le contenu de messages
    GatewayIntentBits.DirectMessages,     // captcha envoyé/reçu en DM
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.GuildMember],
});

client.commands = new Collection();
client.cooldowns = new Collection();

// ---------------------------------------------------------------------------
// Chargement dynamique des commandes (src/commands/*.js)
// ---------------------------------------------------------------------------
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[COMMANDS] Le fichier ${file} ne contient pas 'data' ou 'execute', ignoré.`);
  }
}

// ---------------------------------------------------------------------------
// Chargement dynamique des events (src/events/*.js)
// Chaque fichier export { name, once?, execute(...args, client) }
// ---------------------------------------------------------------------------
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Filets de sécurité : on log au lieu de laisser le process planter
// silencieusement sur Railway (sinon ça redémarre en boucle sans contexte clair).
process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
});
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
});

client.login(process.env.DISCORD_TOKEN);
