const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../database/db');

// Définition centralisée des catégories de ticket : label affiché, emoji,
// préfixe du nom de salon, message d'accueil personnalisé, et la variable
// d'environnement contenant l'ID de la catégorie Discord cible.
const TICKET_CATEGORIES = {
  partenariat: {
    label: 'Partenariat',
    emoji: '🤝',
    prefix: 'partenariat',
    welcomeMessage: 'Merci de nous présenter ton serveur/projet ainsi que le type de partenariat souhaité.',
    envVar: 'TICKET_CATEGORY_PARTENARIAT_ID',
  },
  recrutement: {
    label: 'Recrutement',
    emoji: '📋',
    prefix: 'recrutement',
    welcomeMessage: 'Merci de nous indiquer le poste souhaité, ton âge et ton expérience.',
    envVar: 'TICKET_CATEGORY_RECRUTEMENT_ID',
  },
  recompenses: {
    label: 'Demande de récompenses',
    emoji: '🎁',
    prefix: 'recompense',
    welcomeMessage: 'Merci de préciser la récompense concernée et la preuve associée (capture d\'écran, etc.).',
    envVar: 'TICKET_CATEGORY_RECOMPENSES_ID',
  },
};

/**
 * Crée un salon de ticket privé pour l'utilisateur qui a choisi une catégorie dans le menu.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function createTicket(interaction) {
  const { guild, user } = interaction;

  // La valeur sélectionnée dans le menu déroulant (partenariat / recrutement / recompenses)
  const categoryKey = interaction.values?.[0];
  const categoryInfo = TICKET_CATEGORIES[categoryKey];

  if (!categoryInfo) {
    return interaction.reply({ content: '❌ Catégorie de ticket invalide.', ephemeral: true });
  }

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

  // Catégorie Discord cible : on cherche d'abord la variable spécifique au
  // type de ticket (ex: TICKET_CATEGORY_PARTENARIAT_ID), sinon on retombe
  // sur TICKET_CATEGORY_ID (catégorie unique partagée) si elle est définie.
  const categoryId = process.env[categoryInfo.envVar] || process.env.TICKET_CATEGORY_ID || null;
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
      name: `${categoryInfo.prefix}-${user.username}`.toLowerCase().slice(0, 90),
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      permissionOverwrites,
      topic: `Ticket [${categoryInfo.label}] de ${user.tag} (${user.id})`,
    });
  } catch (err) {
    console.error(`[TICKET] Erreur création salon (catégorie ${categoryInfo.envVar}=${categoryId}):`, err.message);
    return interaction.reply({
      content: `❌ Impossible de créer le ticket. Vérifie que le bot a bien la permission "Gérer les salons" et que \`${categoryInfo.envVar}\` (ou \`TICKET_CATEGORY_ID\`) contient bien l'ID d'une catégorie existante.`,
      ephemeral: true,
    });
  }

  db.prepare(
    'INSERT INTO tickets (channel_id, guild_id, user_id, category, status, created_at) VALUES (?, ?, ?, ?, \'open\', ?)',
  ).run(channel.id, guild.id, user.id, categoryKey, Date.now());

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${categoryInfo.emoji} Ticket — ${categoryInfo.label}`)
    .setDescription(
      `Bienvenue ${user} !\n${categoryInfo.welcomeMessage}\nUn membre du staff te répondra dès que possible.`,
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
