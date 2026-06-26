const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getStreamsByLogin } = require('../utils/twitchApi');

/**
 * Synchronise la table twitch_streamers avec la liste TWITCH_STREAMERS de l'env.
 * Permet d'ajouter/retirer des streamers juste en changeant la variable d'env,
 * sans avoir à toucher à la DB manuellement.
 */
function syncStreamerList(guildId) {
  const logins = (process.env.TWITCH_STREAMERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const insert = db.prepare(
    'INSERT INTO twitch_streamers (login, guild_id, is_live, last_stream_id) VALUES (?, ?, 0, NULL) ON CONFLICT(login) DO NOTHING',
  );

  for (const login of logins) {
    insert.run(login, guildId);
  }

  return logins;
}

async function checkStreamers(client) {
  const channelId = process.env.TWITCH_ANNOUNCE_CHANNEL_ID;
  if (!channelId) return; // Pas configuré, on ne fait rien.

  const guild = client.guilds.cache.first();
  if (!guild) return;

  const logins = syncStreamerList(guild.id);
  if (!logins.length) return;

  let streams;
  try {
    streams = await getStreamsByLogin(logins);
  } catch (err) {
    console.error('[TWITCH] Erreur lors de la récupération des streams:', err.message);
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.warn('[TWITCH] TWITCH_ANNOUNCE_CHANNEL_ID configuré mais salon introuvable.');
    return;
  }

  const pingRoleId = process.env.TWITCH_PING_ROLE_ID;

  for (const login of logins) {
    const row = db.prepare('SELECT * FROM twitch_streamers WHERE login = ?').get(login);
    const stream = streams.get(login);

    const isNowLive = Boolean(stream);
    const wasLive = Boolean(row?.is_live);

    if (isNowLive && !wasLive) {
      // Transition offline -> online : on annonce !
      const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setTitle(`🔴 ${stream.user_name} est en live !`)
        .setURL(`https://twitch.tv/${login}`)
        .setDescription(stream.title || 'Aucun titre')
        .addFields({ name: 'Catégorie', value: stream.game_name || 'Non spécifiée', inline: true })
        .setImage(
          stream.thumbnail_url
            ? stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720') + `?t=${Date.now()}`
            : null,
        )
        .setTimestamp();

      const content = pingRoleId
        ? `<@&${pingRoleId}> **${stream.user_name}** est en live sur Twitch !`
        : `**${stream.user_name}** est en live sur Twitch !`;

      channel.send({ content, embeds: [embed] }).catch((err) => {
        console.error('[TWITCH] Impossible d\'envoyer la notification:', err.message);
      });
    }

    db.prepare('UPDATE twitch_streamers SET is_live = ?, last_stream_id = ? WHERE login = ?').run(
      isNowLive ? 1 : 0,
      stream?.id || null,
      login,
    );
  }
}

/**
 * Démarre le polling périodique. À appeler une seule fois au démarrage du bot.
 */
function startTwitchPolling(client) {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.log('[TWITCH] TWITCH_CLIENT_ID/SECRET non configurés, notifications live désactivées.');
    return;
  }
  if (!process.env.TWITCH_STREAMERS) {
    console.log('[TWITCH] TWITCH_STREAMERS non configuré, notifications live désactivées.');
    return;
  }

  const intervalSec = Math.max(Number(process.env.TWITCH_CHECK_INTERVAL) || 60, 30);
  console.log(`[TWITCH] Polling démarré (toutes les ${intervalSec}s) pour: ${process.env.TWITCH_STREAMERS}`);

  checkStreamers(client); // premier check immédiat
  setInterval(() => checkStreamers(client), intervalSec * 1000);
}

module.exports = { startTwitchPolling };
