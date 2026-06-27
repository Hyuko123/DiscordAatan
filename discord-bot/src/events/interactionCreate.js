const { createTicket, closeTicket } = require('../handlers/ticketHandler');
const { startVerification } = require('../handlers/verifyHandler');
const { joinGiveaway } = require('../handlers/giveawayHandler');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // -------------------------------------------------------------
    // Slash commands
    // -------------------------------------------------------------
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`[INTERACTION] Commande inconnue: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[INTERACTION] Erreur dans la commande ${interaction.commandName}:`, err);
        const errorPayload = { content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorPayload).catch(() => {});
        } else {
          await interaction.reply(errorPayload).catch(() => {});
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // Boutons
    // -------------------------------------------------------------
    if (interaction.isButton()) {
      try {
        switch (interaction.customId) {
          case 'ticket_close':
            await closeTicket(interaction);
            break;
          case 'verify_start':
            await startVerification(interaction);
            break;
          case 'giveaway_join':
            await joinGiveaway(interaction);
            break;
          default:
            // customId géré ailleurs -> on laisse passer sans erreur
            break;
        }
      } catch (err) {
        console.error(`[INTERACTION] Erreur sur le bouton ${interaction.customId}:`, err);
        const errorPayload = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorPayload).catch(() => {});
        } else {
          await interaction.reply(errorPayload).catch(() => {});
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // Menus déroulants (Select Menus)
    // -------------------------------------------------------------
    if (interaction.isStringSelectMenu()) {
      try {
        switch (interaction.customId) {
          case 'ticket_create_select':
            await createTicket(interaction);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error(`[INTERACTION] Erreur sur le menu ${interaction.customId}:`, err);
        const errorPayload = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorPayload).catch(() => {});
        } else {
          await interaction.reply(errorPayload).catch(() => {});
        }
      }
    }
  },
};
