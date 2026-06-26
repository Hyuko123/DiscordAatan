/**
 * Petit client minimal pour l'API Twitch Helix.
 * Utilise le flow "Client Credentials" (App Access Token) : pas besoin
 * que les streamers autorisent quoi que ce soit, on lit juste des infos publiques.
 */

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants dans les variables d\'environnement.');
  }

  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Twitch OAuth a échoué (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Récupère le statut live de plusieurs streamers en une seule requête.
 * @param {string[]} logins - pseudos Twitch (lowercase, sans @)
 * @returns {Promise<Map<string, object>>} map login -> objet stream (si live)
 */
async function getStreamsByLogin(logins) {
  if (!logins.length) return new Map();

  const token = await getAppAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID;

  const params = logins.map((login) => `user_login=${encodeURIComponent(login)}`).join('&');
  const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
    headers: {
      'Client-Id': clientId,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Twitch Helix /streams a échoué (${res.status}): ${await res.text()}`);
  }

  const { data } = await res.json();
  const map = new Map();
  for (const stream of data) {
    map.set(stream.user_login.toLowerCase(), stream);
  }
  return map;
}

module.exports = { getStreamsByLogin };
