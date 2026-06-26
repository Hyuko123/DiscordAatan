const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Affiche la liste des commandes disponibles.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📖 Commandes disponibles')
      .addFields(
        { name: '/ticket-panel', value: 'Envoie le panneau de création de ticket (staff)', inline: false },
        { name: '/verify-panel', value: 'Envoie le panneau de vérification captcha (staff)', inline: false },
        { name: '/sondage', value: 'Crée un sondage avec jusqu\'à 5 options', inline: false },
        { name: '/giveaway', value: 'Lance un giveaway avec durée et nombre de gagnants', inline: false },
        { name: '/help', value: 'Affiche ce message', inline: false },
      )
      .setFooter({ text: 'Bot configuré pour ce serveur' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
