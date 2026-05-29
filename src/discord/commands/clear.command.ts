import {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    type Collection,
    type Message,
    type Snowflake,
} from 'discord.js';

import type { BotCommand } from './command.js';
import { sendModLog } from '../services/mod-log.service.js';
import { logger } from '../../shared/logger.js';

const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const REQUIRED_BOT_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages,
];

function isBulkDeletable(message: Message): boolean {
    return Date.now() - message.createdTimestamp < BULK_DELETE_MAX_AGE_MS;
}

async function deleteOldMessagesIndividually(messages: Message[]): Promise<number> {
    let deleted = 0;

    for (const message of messages) {
        try {
            await message.delete();
            deleted++;
        } catch (error) {
            logger.warn('Failed to delete old message individually.', {
                messageId: message.id,
                channelId: message.channelId,
                authorId: message.author.id,
                isBot: message.author.bot,
                error,
            });
        }
    }

    return deleted;
}

export const clearCommand: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete messages from the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption((option) =>
            option
                .setName('amount')
                .setDescription('Number of messages to delete, from 1 to 100.')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName('member')
                .setDescription('Only delete messages from this member or bot.')
                .setRequired(false),
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) {
            await interaction.editReply({
                content: 'This command can only be used inside a Discord server.',
            });

            return;
        }

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            await interaction.editReply({
                content: 'You need the Manage Messages permission to use this command.',
            });

            return;
        }

        if (!interaction.appPermissions?.has(REQUIRED_BOT_PERMISSIONS)) {
            await interaction.editReply({
                content:
                    'I am missing permissions in this channel. I need: View Channel, Read Message History and Manage Messages.',
            });

            return;
        }

        const channel = interaction.channel;

        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            await interaction.editReply({
                content: 'This command can only be used in a text channel.',
            });

            return;
        }

        if (!('messages' in channel) || !('bulkDelete' in channel)) {
            await interaction.editReply({
                content: 'This channel type does not support message deletion.',
            });

            return;
        }

        const amount = interaction.options.getInteger('amount', true);
        const filterUser = interaction.options.getUser('member');

        const fetchedMessages = await channel.messages.fetch({ limit: 100 });

        const selectedMessages = [...fetchedMessages.values()]
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
            .filter((message) => !filterUser || message.author.id === filterUser.id)
            .slice(0, amount);

        const recentMessages = selectedMessages.filter(isBulkDeletable);
        const oldMessages = selectedMessages.filter((message) => !isBulkDeletable(message));

        logger.info('Clear command message selection completed.', {
            guildId: interaction.guildId,
            channelId: channel.id,
            moderatorId: interaction.user.id,
            requestedAmount: amount,
            fetchedCount: fetchedMessages.size,
            selectedCount: selectedMessages.length,
            recentCount: recentMessages.length,
            oldCount: oldMessages.length,
            botMessageCount: selectedMessages.filter((message) => message.author.bot).length,
            filterUserId: filterUser?.id ?? null,
        });

        if (selectedMessages.length === 0) {
            await interaction.editReply({
                content: filterUser
                    ? `No messages found for ${filterUser.tag} in this channel.`
                    : 'No messages found in this channel.',
            });

            return;
        }

        let deletedRecentCount = 0;

        if (recentMessages.length > 0) {
            const deletedRecentMessages = await channel.bulkDelete(recentMessages, true);
            deletedRecentCount = deletedRecentMessages.size;
        }

        const deletedOldCount =
            oldMessages.length > 0 ? await deleteOldMessagesIndividually(oldMessages) : 0;

        const deletedTotal = deletedRecentCount + deletedOldCount;

        if (deletedTotal === 0) {
            await interaction.editReply({
                content:
                    'No messages were deleted. Check my channel permissions and make sure the selected messages still exist.',
            });

            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🧹 Messages deleted')
            .setColor('#3b82f6')
            .addFields(
                {
                    name: 'Deleted',
                    value: `${deletedTotal}`,
                    inline: true,
                },
                {
                    name: 'Recent',
                    value: `${deletedRecentCount}`,
                    inline: true,
                },
                {
                    name: 'Older than 14 days',
                    value: `${deletedOldCount}`,
                    inline: true,
                },
                {
                    name: 'Channel',
                    value: `<#${channel.id}>`,
                    inline: true,
                },
                ...(filterUser
                    ? [
                          {
                              name: 'Member filter',
                              value: `<@${filterUser.id}>`,
                              inline: true,
                          },
                      ]
                    : []),
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        await sendModLog(interaction.client, {
            action: 'CLEAR',
            moderator: {
                id: interaction.user.id,
                tag: interaction.user.tag,
            },
            extra: {
                Deleted: `${deletedTotal}`,
                Recent: `${deletedRecentCount}`,
                'Older than 14 days': `${deletedOldCount}`,
                Channel: `<#${channel.id}>`,
                ...(filterUser ? { 'Member filter': filterUser.tag } : {}),
            },
        });
    },
};