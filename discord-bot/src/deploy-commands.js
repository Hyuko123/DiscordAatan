require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`[DEPLOY] Déploiement de ${commands.length} commande(s) slash...`);

    let data;
    if (process.env.GUILD_ID) {
      // Déploiement sur un seul serveur : quasi instantané, idéal en dev/test
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`[DEPLOY] ${data.length} commande(s) déployée(s) sur le serveur ${process.env.GUILD_ID}.`);
    } else {
      // Déploiement global : peut prendre jusqu'à 1h pour se propager partout
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`[DEPLOY] ${data.length} commande(s) déployée(s) globalement (propagation jusqu'à 1h).`);
    }
  } catch (error) {
    console.error('[DEPLOY] Erreur lors du déploiement des commandes:', error);
    process.exit(1);
  }
})();
