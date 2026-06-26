const { handleDmAttempt } = require('../handlers/verifyHandler');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // On ne traite que les DM (pas les messages de serveur), et on ignore les bots.
    if (message.guild || message.author.bot) return;

    await handleDmAttempt(message, client);
  },
};
