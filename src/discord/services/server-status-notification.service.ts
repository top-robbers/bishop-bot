import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

import { logger } from '../../shared/logger.js';

export type ServerStatusCommand = 'start' | 'stop' | 'restart';

export type ServerStatusNotification = {
    command: ServerStatusCommand;
    success: boolean;
    service?: string;
    actor?: string;
    host?: string;
    exitCode?: number;
    message?: string;
};

const DEFAULT_SERVICE_NAME = 'Top Robbers server';

function getServerStatusChannelId(): string | undefined {
    return process.env.CHANNEL_SERVER_STATUS;
}

function getCommandLabel(command: ServerStatusCommand): string {
    switch (command) {
        case 'start':
            return 'started';

        case 'stop':
            return 'stopped';

        case 'restart':
            return 'restarted';
    }
}

function getTitle(notification: ServerStatusNotification): string {
    const service = notification.service ?? DEFAULT_SERVICE_NAME;
    const action = getCommandLabel(notification.command);

    if (notification.success) {
        return `✅ ${service} ${action}`;
    }

    return `❌ ${service} ${notification.command} failed`;
}

function getColor(notification: ServerStatusNotification): number {
    return notification.success ? 0x22c55e : 0xef4444;
}

export async function sendServerStatusNotification(
    client: Client,
    notification: ServerStatusNotification,
): Promise<void> {
    const channelId = getServerStatusChannelId();

    if (!channelId) {
        logger.warn('Server status notification skipped. CHANNEL_SERVER_STATUS is not configured.', {
            command: notification.command,
            success: notification.success,
        });

        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);

        if (!channel || !channel.isTextBased() || channel.isDMBased() || !('send' in channel)) {
            logger.warn('Server status notification skipped. Invalid Discord channel.', {
                channelId,
                command: notification.command,
            });

            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(getTitle(notification))
            .setColor(getColor(notification))
            .addFields(
                {
                    name: 'Service',
                    value: notification.service ?? DEFAULT_SERVICE_NAME,
                    inline: true,
                },
                {
                    name: 'Command',
                    value: `\`${notification.command}\``,
                    inline: true,
                },
                {
                    name: 'Status',
                    value: notification.success ? 'Success' : 'Failed',
                    inline: true,
                },
            )
            .setTimestamp();

        if (notification.actor) {
            embed.addFields({
                name: 'Actor',
                value: `\`${notification.actor}\``,
                inline: true,
            });
        }

        if (notification.host) {
            embed.addFields({
                name: 'Host',
                value: `\`${notification.host}\``,
                inline: true,
            });
        }

        if (typeof notification.exitCode === 'number') {
            embed.addFields({
                name: 'Exit code',
                value: `\`${notification.exitCode}\``,
                inline: true,
            });
        }

        if (notification.message) {
            embed.addFields({
                name: 'Message',
                value: notification.message,
            });
        }

        await channel.send({
            embeds: [embed],
        });

        logger.info('Server status notification sent.', {
            channelId,
            command: notification.command,
            success: notification.success,
        });
    } catch (error) {
        logger.error('Failed to send server status notification.', {
            error,
            channelId,
            command: notification.command,
            success: notification.success,
        });
    }
}