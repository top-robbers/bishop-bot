import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required.'),
    DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required.'),
    DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
    DISCORD_DESCRIPTION: z.string().default('Preacher Bishop Discord Bot by Top Robbers'),

    HTTP_HOST: z.string().default('0.0.0.0'),
    HTTP_PORT: z.coerce.number().int().positive().max(65535).default(3000),

    INTERNAL_API_SECRET: z.string().optional(),

    CHANNEL_MOD_LOGS: z.string().optional(),
    CHANNEL_SERVER_STATUS: z.string().optional(),

    SERVER_IP: z.string().default('127.0.0.1'),
    SERVER_PORT: z.coerce.number().int().positive().max(65535).default(7777),
    SERVER_QUERY_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

if (parsed.data.NODE_ENV === 'production') {
    if (!parsed.data.INTERNAL_API_SECRET || parsed.data.INTERNAL_API_SECRET.length < 32) {
        console.error('INTERNAL_API_SECRET must contain at least 32 characters in production.');
        process.exit(1);
    }
}

export const env = parsed.data;
