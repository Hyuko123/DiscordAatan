const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// Timers en mémoire pour les giveaways en cours (clé: message_id).
// Permet d'annuler/replanifier proprement, mais la "source de vérité" reste
// la DB (end_at) pour survivre à un redémarrage du process sur Railway.
const activeTimers = new Map();

/**
 * Ajoute l'utilisateur qui clique sur "Participer" à la liste des entrées.
 */
async function joinGiveaway(interaction) {
  const messageId = interaction.message.id;

  const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
  if (!giveaway || giveaway.ended) {
    return interaction.reply({ content: '❌ Ce giveaway est terminé.', ephemeral: true });
  }

  const already = db
    .prepare('SELECT 1 FROM giveaway_entries WHERE message_id = ? AND user_id = ?')
    .get(messageId, interaction.user.id);

  if (already) {
    return interaction.reply({ content: 'ℹ️ Tu participes déjà à ce giveaway !', ephemeral: true });
  }

  db.prepare('INSERT INTO giveaway_entries (message_id, user_id) VALUES (?, ?)').run(messageId, interaction.user.id);

  await interaction.reply({ content: '🎉 Tu participes au giveaway, bonne chance !', ephemeral: true });
}

/**
 * Tire au sort les gagnants, édite le message original et annonce les résultats.
 */
async function endGiveaway(client, messageId) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
  if (!giveaway || giveaway.ended) return;

  db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?').run(messageId);
  activeTimers.delete(messageId);

  const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE message_id = ?').all(messageId);
  const participantIds = entries.map((e) => e.user_id);

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel) {
    console.warn(`[GIVEAWAY] Salon introuvable pour le giveaway ${messageId}`);
    return;
  }

  // Tirage au sort sans remise
  const winners = [];
  const pool = [...participantIds];
  const winnersCount = Math.min(giveaway.winners_count, pool.length);

  for (let i = 0; i < winnersCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(winners.length ? 0x57f287 : 0xed4245)
    .setTitle('🎉 Giveaway terminé !')
    .setDescription(
      `**Prix :** ${giveaway.prize}\n\n` +
        (winners.length
          ? `**Gagnant(s) :** ${winners.map((id) => `<@${id}>`).join(', ')}`
          : 'Personne n\'a participé, aucun gagnant cette fois-ci.'),
    )
    .setTimestamp();

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (message) {
    await message.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
  }

  await channel.send({
    content: winners.length
      ? `Félicitations ${winners.map((id) => `<@${id}>`).join(', ')} ! Tu remportes **${giveaway.prize}** 🎉`
      : `Aucun gagnant pour le giveaway **${giveaway.prize}** (pas de participants).`,
  }).catch(() => {});
}

/**
 * Planifie la fin d'un giveaway dans `delayMs` millisecondes.
 */
function scheduleGiveawayEnd(client, messageId, delayMs) {
  // setTimeout est limité à ~24.8 jours max en Node ; on plafonne par sécurité.
  const safeDelay = Math.min(delayMs, 2_147_000_000);
  const timer = setTimeout(() => endGiveaway(client, messageId), safeDelay);
  activeTimers.set(messageId, timer);
}

/**
 * Au démarrage du bot, reprend tous les giveaways non terminés stockés en DB.
 * Indispensable car Railway peut redémarrer le process à tout moment.
 */
function resumeGiveaways(client) {
  const pending = db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();

  for (const giveaway of pending) {
    const remaining = giveaway.end_at - Date.now();

    if (remaining <= 0) {
      // Le temps est déjà écoulé pendant que le bot était hors ligne : on tire au sort tout de suite.
      endGiveaway(client, giveaway.message_id);
    } else {
      scheduleGiveawayEnd(client, giveaway.message_id, remaining);
    }
  }

  if (pending.length > 0) {
    console.log(`[GIVEAWAY] ${pending.length} giveaway(s) repris après redémarrage.`);
  }
}

module.exports = { joinGiveaway, endGiveaway, scheduleGiveawayEnd, resumeGiveaways };
