const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-panel')
    .setDescription('Envoie le panneau de vérification (captcha) dans ce salon.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('✅ Vérification requise')
      .setDescription(
        'Pour accéder au reste du serveur, clique sur le bouton ci-dessous.\n' +
          'Un code te sera envoyé **en message privé** : il te suffira de le renvoyer ici pour être vérifié.\n\n' +
          '⚠️ Assure-toi d\'avoir activé les messages privés depuis les membres du serveur.',
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_start')
        .setLabel('Se vérifier')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel de vérification envoyé.', ephemeral: true });
  },
};
