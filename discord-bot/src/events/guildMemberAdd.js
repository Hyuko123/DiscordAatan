const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const { guild, user } = member;

    // ---------------------------------------------------------------
    // 1. Message de bienvenue
    // ---------------------------------------------------------------
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    if (welcomeChannelId) {
      const channel = guild.channels.cache.get(welcomeChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('👋 Bienvenue !')
          .setDescription(`Bienvenue sur **${guild.name}**, ${user} !\nNous sommes maintenant **${guild.memberCount}** membres.`)
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        channel.send({ content: `${user}`, embeds: [embed] }).catch((err) => {
          console.error('[WELCOME] Impossible d\'envoyer le message de bienvenue:', err.message);
        });
      } else {
        console.warn('[WELCOME] WELCOME_CHANNEL_ID configuré mais salon introuvable.');
      }
    }

    // ---------------------------------------------------------------
    // 2. Attribution du rôle "non vérifié" (si configuré)
    // Ce rôle doit avoir des permissions restreintes sur le serveur,
    // configurées manuellement dans Discord (pas géré par le bot).
    // ---------------------------------------------------------------
    const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID;
    if (unverifiedRoleId) {
      const role = guild.roles.cache.get(unverifiedRoleId);
      if (role) {
        member.roles.add(role).catch((err) => {
          console.error('[WELCOME] Impossible d\'ajouter le rôle non-vérifié:', err.message);
        });
      } else {
        console.warn('[WELCOME] UNVERIFIED_ROLE_ID configuré mais rôle introuvable.');
      }
    }
  },
};
