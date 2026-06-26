const { ActivityType } = require('discord.js');
const { startTwitchPolling } = require('../handlers/twitchPoller');
const { resumeGiveaways } = require('../handlers/giveawayHandler');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[READY] Connecté en tant que ${client.user.tag} (${client.guilds.cache.size} serveur(s))`);

    client.user.setPresence({
      activities: [{ name: 'le serveur 👀', type: ActivityType.Watching }],
      status: 'online',
    });

    resumeGiveaways(client);
    startTwitchPolling(client);
  },
};
