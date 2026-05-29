import type { Client } from 'discord.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { sendServerStatusNotification } from '../../discord/services/server-status-notification.service.js';
import { logger } from '../../shared/logger.js';

const tsServerCommandEventSchema = z.object({
    type: z.literal('ts-server.command'),
    payload: z.object({
        command: z.enum(['start', 'stop', 'restart']),
        success: z.boolean(),
        service: z.string().min(1).max(100).optional(),
        actor: z.string().min(1).max(100).optional(),
        host: z.string().min(1).max(100).optional(),
        exitCode: z.number().int().optional(),
        message: z.string().min(1).max(1000).optional(),
    }),
});

const internalEventSchema = z.discriminatedUnion('type', [
    tsServerCommandEventSchema,
]);

export async function registerInternalEventsRoute(
    server: FastifyInstance,
    client: Client,
): Promise<void> {
    if (!env.INTERNAL_API_SECRET) {
        logger.warn('INTERNAL_API_SECRET is not set. The /internal/events route is unprotected.');
    }

    server.post('/internal/events', async (request, reply) => {
        if (env.INTERNAL_API_SECRET) {
            const authorization = request.headers.authorization;
            const expectedAuthorization = `Bearer ${env.INTERNAL_API_SECRET}`;

            if (authorization !== expectedAuthorization) {
                logger.warn('Rejected internal event request.', {
                    reason: 'Invalid authorization header',
                    ip: request.ip,
                });

                return reply.status(401).send({
                    message: 'Unauthorized.',
                });
            }
        }

        const parsed = internalEventSchema.safeParse(request.body);

        if (!parsed.success) {
            logger.warn('Rejected internal event request.', {
                reason: 'Invalid request body',
                errors: parsed.error.flatten(),
            });

            return reply.status(400).send({
                message: 'Invalid request body.',
                errors: parsed.error.flatten(),
            });
        }

        const event = parsed.data;

        logger.info('Internal event received.', {
            type: event.type,
        });

        switch (event.type) {
            case 'ts-server.command':
                await sendServerStatusNotification(client, event.payload);
                break;
        }

        return reply.status(202).send({
            message: 'Accepted.',
        });
    });
}