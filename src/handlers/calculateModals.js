import { successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { evaluateMathExpression } from '../utils/safeMathParser.js';

import { replyUserError, ErrorTypes } from '../utils/errorHandler.js';
function evaluate(expression) {
    return evaluateMathExpression(expression);
}

async function calculateModalHandler(interaction, client, args) {
    try {
        const operation = args[0];
        const operandInput = interaction.fields.first();
        const contextKey = operandInput?.customId?.split(':')[1];
        
        if (!contextKey) {
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudo recuperar el contexto del cálculo.' });
        }

        const { calculationContexts } = await import('../commands/Tools/calculate.js');
        const context = calculationContexts.get(contextKey);
        
        if (!context) {
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Este cálculo caducó. Inicia uno nuevo.' });
        }

        await interaction.deferReply({ ephemeral: false });

        const operand = interaction.fields.getTextInputValue(operandInput.customId);
        
        if (!operand || isNaN(operand)) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Proporciona un número válido.' });
        }

        const { expression, formattedResult, operator } = context;
        const newExpression = `(${expression}) ${operator} (${operand})`;

        let newResult;
        try {
            newResult = evaluate(newExpression);
            
            let formattedNewResult;
            if (typeof newResult === "number") {
                formattedNewResult = newResult.toLocaleString("en-US", {
                    maximumFractionDigits: 10,
                });

                if (
                    Math.abs(newResult) > 0 &&
                    (Math.abs(newResult) >= 1e10 || Math.abs(newResult) < 1e-3)
                ) {
                    formattedNewResult = newResult.toExponential(6);
                }
            } else {
                formattedNewResult = String(newResult);
            }

            const updatedEmbed = successEmbed(
                "🧮 Calculation Result",
                `**Expression:** \`${newExpression.replace(/`/g, "\`")}\`\n` +
                    `**Result:** \`${formattedNewResult}\`\n\n` +
                    `*Use the buttons in the channel message to perform more operations.*`,
            );

            try {
                if (context.messageId && context.channelId) {
                    const channel = await client.channels.fetch(context.channelId);
                    const message = await channel.messages.fetch(context.messageId);
                    await message.edit({
                        embeds: [updatedEmbed],
                    });
                }
            } catch (editError) {
                logger.warn('Could not edit original message:', editError.message);
            }

            calculationContexts.delete(contextKey);

            await interaction.editReply({
                embeds: [successEmbed('✅ Cálculo realizado', `\`${newExpression}\` = \`${formattedNewResult}\``)],
            });

        } catch (calcError) {
            logger.error('Calculate evaluation error:', calcError);
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'No se pudo evaluar la expresión.' });
        }
    } catch (error) {
        logger.error('Calculate modal handler error:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al procesar tu cálculo.' });
            } else {
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al procesar tu cálculo.' });
            }
        } catch (err) {
            logger.error('Failed to send error message:', err);
        }
    }
}

export default {
    execute: calculateModalHandler
};
