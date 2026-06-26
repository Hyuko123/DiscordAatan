const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const { guild, user } = member;

    // Nettoyage : si l'utilisateur avait une vérification en attente, on la supprime
    db.prepare('DELETE FROM pending_verifications WHERE user_id = ? AND guild_id = ?').run(user.id, guild.id);

    const leaveChannelId = process.env.LEAVE_CHANNEL_ID;
    if (!leaveChannelId) return;

    const channel = guild.channels.cache.get(leaveChannelId);
    if (!channel) {
      console.warn('[LEAVE] LEAVE_CHANNEL_ID configuré mais salon introuvable.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('👋 Départ')
      .setDescription(`**${user.tag}** a quitté le serveur.\nNous sommes maintenant **${guild.memberCount}** membres.`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch((err) => {
      console.error('[LEAVE] Impossible d\'envoyer le message de départ:', err.message);
    });
  },
};
