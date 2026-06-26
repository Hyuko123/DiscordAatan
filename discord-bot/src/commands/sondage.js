const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sondage')
    .setDescription('Crée un sondage avec réactions.')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('La question du sondage').setRequired(true),
    )
    .addStringOption((opt) => opt.setName('option1').setDescription('Option 1').setRequired(true))
    .addStringOption((opt) => opt.setName('option2').setDescription('Option 2').setRequired(true))
    .addStringOption((opt) => opt.setName('option3').setDescription('Option 3').setRequired(false))
    .addStringOption((opt) => opt.setName('option4').setDescription('Option 4').setRequired(false))
    .addStringOption((opt) => opt.setName('option5').setDescription('Option 5').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [1, 2, 3, 4, 5]
      .map((n) => interaction.options.getString(`option${n}`))
      .filter(Boolean);

    const description = options.map((opt, i) => `${NUMBER_EMOJIS[i]} ${opt}`).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${question}`)
      .setDescription(description)
      .setFooter({ text: `Sondage lancé par ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    const sent = await interaction.fetchReply();

    for (let i = 0; i < options.length; i++) {
      await sent.react(NUMBER_EMOJIS[i]);
    }
  },
};
