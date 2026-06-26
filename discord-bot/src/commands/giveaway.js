const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const { scheduleGiveawayEnd } = require('../handlers/giveawayHandler');

/**
 * Parse une durée du type "10m", "2h", "1d" en millisecondes.
 */
function parseDuration(input) {
  const match = input.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Lance un giveaway.')
    .addStringOption((opt) =>
      opt.setName('duree').setDescription('Durée (ex: 30s, 10m, 2h, 1d)').setRequired(true),
    )
    .addStringOption((opt) => opt.setName('prix').setDescription('Ce qui est à gagner').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('gagnants').setDescription('Nombre de gagnants (par défaut 1)').setMinValue(1).setMaxValue(20),
    ),

  async execute(interaction) {
    const durationInput = interaction.options.getString('duree');
    const prize = interaction.options.getString('prix');
    const winnersCount = interaction.options.getInteger('gagnants') ?? 1;

    const durationMs = parseDuration(durationInput);
    if (!durationMs || durationMs < 5000) {
      return interaction.reply({
        content: '❌ Durée invalide. Utilise un format comme `30s`, `10m`, `2h` ou `1d` (minimum 5 secondes).',
        ephemeral: true,
      });
    }

    const endAt = Date.now() + durationMs;

    const embed = new EmbedBuilder()
      .setColor(0xeb459e)
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(
        `**Prix :** ${prize}\n` +
          `**Gagnant(s) :** ${winnersCount}\n` +
          `**Se termine :** <t:${Math.floor(endAt / 1000)}:R>\n\n` +
          'Clique sur 🎉 ci-dessous pour participer !',
      )
      .setFooter({ text: `Organisé par ${interaction.user.tag}` })
      .setTimestamp(endAt);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('giveaway_join').setLabel('Participer').setEmoji('🎉').setStyle(ButtonStyle.Success),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
    const sent = await interaction.fetchReply();

    db.prepare(
      `INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winners_count, host_id, end_at, ended)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(sent.id, sent.channelId, interaction.guildId, prize, winnersCount, interaction.user.id, endAt);

    scheduleGiveawayEnd(interaction.client, sent.id, durationMs);
  },
};
