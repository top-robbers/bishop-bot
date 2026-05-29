/*import { Collection } from 'discord.js';
import { pingCommand } from './ping.command.js';
import type { BotCommand } from './command.js';

export const commands = new Collection<string, BotCommand>();

for (const command of [pingCommand]) {
    commands.set(command.data.name, command);
}

export const commandPayloads = [...commands.values()].map((command) => command.data.toJSON());*/

import { Collection } from 'discord.js';
import type { BotCommand } from './command.js';

import { pingCommand } from './ping.command.js';
import { clearCommand } from './clear.command.js';
import { serverStatusCommand } from './serverstatus.command.js';

export const commands = new Collection<string, BotCommand>();

for (const command of [
    pingCommand,
    clearCommand,
    serverStatusCommand,
]) {
    commands.set(command.data.name, command);
}

export const commandPayloads = [...commands.values()].map((command) => command.data.toJSON());
