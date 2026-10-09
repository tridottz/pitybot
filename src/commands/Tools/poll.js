import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { InteractionAyudaer } from '../../utils/interactionAyudaer.js';
const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const MAX_OPTIONS = 10;
export default {
    data: new SlashCommandBuilder()
        .setName('encuesta')
        .setDescription('Crea una encuesta sencilla con hasta 10 opciones')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('La pregunta de la encuesta')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('Primera opción')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Segunda opción')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('option3')
                .setDescription('Tercera opción (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option4')
                .setDescription('Cuarta opción (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option5')
                .setDescription('Quinta opción (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option6')
                .setDescription('Sexta opción (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option7')
                .setDescription('Séptima opción (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option8')
                .setDescription('Octava opción (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option9')
                .setDescription('Novena opción (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option10')
                .setDescription('Décima opción (opcional)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('anonymous')
                .setDescription('Haz que la encuesta sea anónima (predeterminado: falso)')
                .setRequired(false)),

    async execute(interaction) {
        const deferSuccess = await InteractionAyudaer.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn(`Poll interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'poll'
            });
            return;
        }

        const question = interaction.options.getString('question');
        const isAnonymous = interaction.options.getBoolean('anonymous') || false;

        const options = [];
        for (let i = 1; i <= MAX_OPTIONS; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) options.push(option);
        }

        if (options.length < 2) {
            throw new Error("You must provide at least 2 options for the poll.");
        }

        let description = `**${question}**\n\n`;
        options.forEach((option, index) => {
            description += `${EMOJIS[index]} ${option}\n`;
        });

        if (isAnonymous) {
            description += '\n*This is an anonymous poll. Votes are not tracked to users.*';
        } else {
            description += '\n*React with the emoji to vote!*';
        }

        const embed = successEmbed(
            `📊 ${isAnonymous ? 'Anonymous ' : ''}Poll`,
            description
        );

        const message = await interaction.channel.send({ embeds: [embed] });

        for (let i = 0; i < options.length; i++) {
            await message.react(EMOJIS[i]);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        await InteractionAyudaer.safeEditReply(interaction, {
            content: '✅ Poll created successfully!',
        });
    },
};