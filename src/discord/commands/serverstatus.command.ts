import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from './command.js';
import { queryServer } from '../services/server-query.service.js';
import { env } from '../../config/env.js';

export const serverStatusCommand: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('serverstatus')
        .setDescription('Affiche l\'état actuel du serveur Top Robbers.'),

    async execute(interaction) {
        await interaction.deferReply();

        const info = await queryServer(env.SERVER_IP, env.SERVER_PORT);

        if (!info.online) {
            const embed = new EmbedBuilder()
                .setTitle('🔴 Serveur hors ligne')
                .setColor('#ef4444')
                .setDescription('Le serveur Top Robbers est actuellement inaccessible.')
                .addFields(
                    { name: 'Adresse', value: `${env.SERVER_IP}:${env.SERVER_PORT}`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const occupancyPercent = Math.round((info.players / info.maxPlayers) * 100);

        const statusColor =
            occupancyPercent >= 80 ? '#22c55e'  // vert — serveur bien rempli
            : occupancyPercent >= 30 ? '#f59e0b' // orange — serveur modéré
            : '#3b82f6';                          // bleu — serveur peu peuplé

        const occupancyBar = buildOccupancyBar(info.players, info.maxPlayers);

        const embed = new EmbedBuilder()
            .setTitle('🟢 Serveur en ligne')
            .setColor(statusColor)
            .setDescription(`**${info.hostname}**`)
            .addFields(
                {
                    name: '👥 Joueurs',
                    value: `${info.players} / ${info.maxPlayers}`,
                    inline: true,
                },
                {
                    name: '📡 Adresse',
                    value: `\`${env.SERVER_IP}:${env.SERVER_PORT}\``,
                    inline: true,
                },
                {
                    name: '📊 Occupation',
                    value: `${occupancyBar} ${occupancyPercent}%`,
                    inline: false,
                },
            )
            .setFooter({ text: 'Connectez-vous via SA-MP / open.mp' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};

function buildOccupancyBar(players: number, maxPlayers: number, length = 12): string {
    const filled = Math.round((players / maxPlayers) * length);
    const empty = length - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}