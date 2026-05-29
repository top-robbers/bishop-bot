import type { Client, ColorResolvable } from 'discord.js';
import { EmbedBuilder, TextChannel } from 'discord.js';

import { getChannelId } from './channel-config.service.js';
import { logger } from '../../shared/logger.js';

export type ModAction =
    | 'WARN'
    | 'WARN_CLEARED'
    | 'KICK'
    | 'BAN'
    | 'TIMEOUT'
    | 'CLEAR';

const ACTION_COLORS: Record<ModAction, ColorResolvable> = {
    WARN: '#f59e0b',
    WARN_CLEARED: '#6b7280',
    KICK: '#f97316',
    BAN: '#ef4444',
    TIMEOUT: '#8b5cf6',
    CLEAR: '#3b82f6',
};

const ACTION_LABELS: Record<ModAction, string> = {
    WARN: '⚠️ Warning issued',
    WARN_CLEARED: '🗑️ Warnings cleared',
    KICK: '👢 Member kicked',
    BAN: '🔨 Member banned',
    TIMEOUT: '⏱️ Member timed out',
    CLEAR: '🧹 Messages purged',
};

export type ModLogEntry = {
    action: ModAction;
    moderator: { id: string; tag: string };
    target?: { id: string; tag: string };
    reason?: string;
    extra?: Record<string, string>;
};

export async function sendModLog(client: Client, entry: ModLogEntry): Promise<void> {
    const channelId = getChannelId('mod.logs');

    if (!channelId) {
        logger.debug('Mod log skipped — CHANNEL_MOD_LOGS is not configured.', {
            action: entry.action,
        });

        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);

        if (!(channel instanceof TextChannel)) {
            logger.warn('Mod log channel is not a text channel.', {
                channelId,
            });

            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(ACTION_LABELS[entry.action])
            .setColor(ACTION_COLORS[entry.action])
            .setTimestamp()
            .addFields({
                name: 'Moderator',
                value: `<@${entry.moderator.id}> (${entry.moderator.tag})`,
                inline: true,
            });

        if (entry.target) {
            embed.addFields({
                name: 'Member',
                value: `<@${entry.target.id}> (${entry.target.tag})`,
                inline: true,
            });
        }

        if (entry.reason) {
            embed.addFields({
                name: 'Reason',
                value: entry.reason,
            });
        }

        if (entry.extra) {
            for (const [key, value] of Object.entries(entry.extra)) {
                embed.addFields({
                    name: key,
                    value,
                    inline: true,
                });
            }
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        logger.error('Failed to send mod log.', {
            error,
            action: entry.action,
        });
    }
}