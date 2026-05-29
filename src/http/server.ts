import type { Client } from 'discord.js';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerHealthRoute } from './routes/health.route.js';
import { registerInternalEventsRoute } from './routes/events.route.js';

export async function createHttpServer(client: Client): Promise<FastifyInstance> {
    const server = Fastify({
        logger: false,
    });

    await registerHealthRoute(server, client);
    await registerInternalEventsRoute(server, client);

    return server;
}