import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

export type EventChannelType =
    | 'server.status'
    | 'mod.logs';

const channelOverrides = new Map<EventChannelType, string>();

const ENV_CHANNEL_MAP: Record<EventChannelType, string | undefined> = {
    'server.status': env.CHANNEL_SERVER_STATUS,
    'mod.logs': env.CHANNEL_MOD_LOGS,
};

export function getChannelId(type: EventChannelType): string | undefined {
    return channelOverrides.get(type) ?? ENV_CHANNEL_MAP[type];
}

export function setChannelOverride(type: EventChannelType, channelId: string): void {
    channelOverrides.set(type, channelId);
    logger.info('Channel override set.', { type, channelId });
}

export function getAllChannelConfig(): Record<EventChannelType, string | undefined> {
    const types: EventChannelType[] = [
        'server.status',
        'mod.logs',
    ];

    return Object.fromEntries(
        types.map((type) => [type, getChannelId(type)]),
    ) as Record<EventChannelType, string | undefined>;
}