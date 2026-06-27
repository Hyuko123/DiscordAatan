const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Envoie le panneau permettant de créer un ticket dans ce salon.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎫 Support — Ouvrir un ticket')
      .setDescription(
        'Besoin d\'aide ou d\'une question pour le staff ?\nChoisis une catégorie dans le menu ci-dessous pour ouvrir un ticket privé.',
      );

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_create_select')
        .setPlaceholder('Choisis une catégorie...')
        .addOptions(
          { label: 'Partenariat', value: 'partenariat', emoji: '🤝', description: 'Proposer un partenariat avec le serveur' },
          { label: 'Recrutement', value: 'recrutement', emoji: '📋', description: 'Postuler pour rejoindre le staff' },
          { label: 'Demande de récompenses', value: 'recompenses', emoji: '🎁', description: 'Réclamer une récompense obtenue' },
        ),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel de ticket envoyé.', ephemeral: true });
  },
};

