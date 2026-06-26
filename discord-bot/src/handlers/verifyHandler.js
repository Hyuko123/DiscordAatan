const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 3;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Génère un code alphanumérique simple à lire (évite les caractères ambigus
 * comme 0/O ou 1/I/l pour ne pas frustrer l'utilisateur en DM).
 */
function generateCode(length = CODE_LENGTH) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Démarre la vérification : génère un code, l'envoie en DM, et le stocke en DB.
 * Appelé quand l'utilisateur clique sur le bouton "Se vérifier".
 */
async function startVerification(interaction) {
  const { guild, user } = interaction;

  const alreadyVerifiedRoleId = process.env.VERIFIED_ROLE_ID;
  if (alreadyVerifiedRoleId) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member?.roles.cache.has(alreadyVerifiedRoleId)) {
      return interaction.reply({ content: '✅ Tu es déjà vérifié !', ephemeral: true });
    }
  }

  const code = generateCode();

  db.prepare(
    `INSERT INTO pending_verifications (user_id, guild_id, code, attempts, created_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(user_id, guild_id) DO UPDATE SET code = excluded.code, attempts = 0, created_at = excluded.created_at`,
  ).run(user.id, guild.id, code, Date.now());

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔐 Vérification')
    .setDescription(
      `Voici ton code de vérification pour **${guild.name}** :\n\n` +
        `### \`${code}\`\n\n` +
        'Renvoie-le moi ici, dans ce message privé, pour valider ton accès.\n' +
        `Ce code expire dans 10 minutes (max ${MAX_ATTEMPTS} tentatives).`,
    );

  try {
    await user.send({ embeds: [embed] });
    await interaction.reply({
      content: '📨 Je t\'ai envoyé un code en message privé ! Reviens ici une fois vérifié.',
      ephemeral: true,
    });
  } catch (err) {
    // Cas très fréquent : DM fermés. On nettoie l'entrée DB et on explique.
    db.prepare('DELETE FROM pending_verifications WHERE user_id = ? AND guild_id = ?').run(user.id, guild.id);
    await interaction.reply({
      content:
        '❌ Je n\'ai pas pu t\'envoyer de message privé.\n' +
        'Va dans **Paramètres du serveur > Confidentialité** (clic droit sur le serveur) et active ' +
        '"Autoriser les messages privés des membres du serveur", puis réessaie.',
      ephemeral: true,
    });
  }
}

/**
 * Traite un message reçu en DM : vérifie si l'utilisateur a une vérification
 * en attente et si le code correspond.
 */
async function handleDmAttempt(message, client) {
  const userId = message.author.id;

  const pending = db
    .prepare('SELECT * FROM pending_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId);

  if (!pending) return; // Pas de vérification en attente, on ignore silencieusement.

  // Expiration du code
  if (Date.now() - pending.created_at > CODE_TTL_MS) {
    db.prepare('DELETE FROM pending_verifications WHERE user_id = ? AND guild_id = ?').run(userId, pending.guild_id);
    return message.reply('⌛ Ce code a expiré. Retourne sur le serveur et clique à nouveau sur "Se vérifier".');
  }

  const submitted = message.content.trim().toUpperCase();

  if (submitted !== pending.code) {
    const attempts = pending.attempts + 1;

    if (attempts >= MAX_ATTEMPTS) {
      db.prepare('DELETE FROM pending_verifications WHERE user_id = ? AND guild_id = ?').run(userId, pending.guild_id);
      return message.reply(
        '❌ Code incorrect. Nombre maximum de tentatives atteint.\nRetourne sur le serveur et clique à nouveau sur "Se vérifier" pour recevoir un nouveau code.',
      );
    }

    db.prepare('UPDATE pending_verifications SET attempts = ? WHERE user_id = ? AND guild_id = ?').run(
      attempts,
      userId,
      pending.guild_id,
    );
    return message.reply(`❌ Code incorrect. Il te reste **${MAX_ATTEMPTS - attempts}** tentative(s).`);
  }

  // Code correct : on attribue le rôle vérifié et on retire le rôle non-vérifié.
  const guild = client.guilds.cache.get(pending.guild_id);
  if (!guild) {
    db.prepare('DELETE FROM pending_verifications WHERE user_id = ? AND guild_id = ?').run(userId, pending.guild_id);
    return message.reply('⚠️ Une erreur est survenue (serveur introuvable). Contacte un membre du staff.');
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    db.prepare('DELETE FROM pending_verifications WHERE user_id = ? AND guild_id = ?').run(userId, pending.guild_id);
    return message.reply('⚠️ Une erreur est survenue (membre introuvable sur le serveur). Contacte un membre du staff.');
  }

  const verifiedRoleId = process.env.VERIFIED_ROLE_ID;
  const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID;

  try {
    if (verifiedRoleId) await member.roles.add(verifiedRoleId);
    if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
      await member.roles.remove(unverifiedRoleId);
    }
  } catch (err) {
    console.error('[VERIFY] Erreur attribution rôle:', err.message);
    return message.reply(
      '⚠️ Code correct, mais je n\'ai pas pu modifier tes rôles (permissions manquantes du bot). Contacte un membre du staff.',
    );
  }

  db.prepare('DELETE FROM pending_verifications WHERE user_id = ? AND guild_id = ?').run(userId, pending.guild_id);

  await message.reply(`✅ Vérification réussie ! Tu as maintenant accès à **${guild.name}**.`);
}

module.exports = { startVerification, handleDmAttempt };
