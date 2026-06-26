const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../database/db');

/**
 * Crée un salon de ticket privé pour l'utilisateur qui a cliqué sur le bouton.
 */
async function createTicket(interaction) {
  const { guild, user } = interaction;

  // On évite les doublons : un seul ticket ouvert à la fois par utilisateur.
  const existing = db
    .prepare('SELECT channel_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = \'open\'')
    .get(guild.id, user.id);

  if (existing) {
    const channel = guild.channels.cache.get(existing.channel_id);
    if (channel) {
      return interaction.reply({
        content: `❌ Tu as déjà un ticket ouvert : ${channel}`,
        ephemeral: true,
      });
    }
    // Le salon n'existe plus mais la DB pensait que si : on nettoie et on continue.
    db.prepare('DELETE FROM tickets WHERE channel_id = ?').run(existing.channel_id);
  }

  const categoryId = process.env.TICKET_CATEGORY_ID || null;
  const staffRoleIds = (process.env.TICKET_STAFF_ROLE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
    },
  ];

  for (const roleId of staffRoleIds) {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${user.username}`.toLowerCase().slice(0, 90),
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      permissionOverwrites,
      topic: `Ticket de ${user.tag} (${user.id})`,
    });
  } catch (err) {
    console.error('[TICKET] Erreur création salon:', err.message);
    return interaction.reply({
      content: '❌ Impossible de créer le ticket. Vérifie que le bot a bien la permission "Gérer les salons" et que la catégorie configurée existe.',
      ephemeral: true,
    });
  }

  db.prepare(
    'INSERT INTO tickets (channel_id, guild_id, user_id, status, created_at) VALUES (?, ?, ?, \'open\', ?)',
  ).run(channel.id, guild.id, user.id, Date.now());

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Nouveau ticket')
    .setDescription(
      `Bienvenue ${user}, merci de décrire ta demande.\nUn membre du staff te répondra dès que possible.`,
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Fermer le ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );

  const pingStaff = staffRoleIds.map((id) => `<@&${id}>`).join(' ');
  await channel.send({ content: `${user} ${pingStaff}`.trim(), embeds: [embed], components: [row] });

  await interaction.reply({ content: `✅ Ton ticket a été créé : ${channel}`, ephemeral: true });
}

/**
 * Ferme (supprime) le salon de ticket courant.
 */
async function closeTicket(interaction) {
  const { channel, guild } = interaction;

  const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channel.id);
  if (!ticket) {
    return interaction.reply({
      content: '❌ Ce salon n\'est pas reconnu comme un ticket actif.',
      ephemeral: true,
    });
  }

  await interaction.reply({ content: '🔒 Fermeture du ticket dans 5 secondes...' });

  db.prepare('UPDATE tickets SET status = \'closed\' WHERE channel_id = ?').run(channel.id);

  setTimeout(() => {
    channel.delete().catch((err) => {
      console.error('[TICKET] Erreur suppression salon:', err.message);
    });
  }, 5000);
}

module.exports = { createTicket, closeTicket };
