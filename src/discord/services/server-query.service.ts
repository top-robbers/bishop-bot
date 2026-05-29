import dgram from 'node:dgram';
import { logger } from '../../shared/logger.js';

export type ServerInfo = {
    online: boolean;
    players: number;
    maxPlayers: number;
    hostname: string;
};

const QUERY_TIMEOUT_MS = 5_000;

/**
 * Queries an open.mp / SA-MP server using the SA-MP UDP query protocol.
 * Packet format: "SAMP" + 4 bytes IP + 2 bytes port + 'i' (info opcode)
 *
 * Response layout (info packet):
 *   4 bytes  — password flag
 *   2 bytes  — player count
 *   2 bytes  — max players
 *   4+n bytes — hostname (Pascal string: 4-byte length prefix + chars)
 *   ... (gamemode, language — ignored)
 */
export async function queryServer(ip: string, port: number): Promise<ServerInfo> {
    return new Promise((resolve) => {
        const fallback: ServerInfo = { online: false, players: 0, maxPlayers: 0, hostname: '' };

        const socket = dgram.createSocket('udp4');
        let settled = false;

        const finish = (result: ServerInfo) => {
            if (settled) return;
            settled = true;
            socket.close();
            resolve(result);
        };

        const timeout = setTimeout(() => {
            logger.debug('Server query timed out.', { ip, port });
            finish(fallback);
        }, QUERY_TIMEOUT_MS);

        socket.on('error', (err) => {
            clearTimeout(timeout);
            logger.debug('Server query socket error.', { error: err.message });
            finish(fallback);
        });

        socket.on('message', (msg) => {
            clearTimeout(timeout);

            try {
                // Skip 11-byte header ("SAMP" + 4-byte IP + 2-byte port + 1-byte opcode + 1 padding)
                // Actual response starts at offset 11
                let offset = 11;

                // 1 byte — password flag
                offset += 1;

                // 2 bytes — current players
                const players = msg.readUInt16LE(offset);
                offset += 2;

                // 2 bytes — max player
                const maxPlayers = msg.readUInt16LE(offset);
                offset += 2;

                // 4 bytes — hostname length, then hostname string
                const hostnameLen = msg.readUInt32LE(offset);
                offset += 4;
                const hostname = msg.subarray(offset, offset + hostnameLen).toString('utf8');

                finish({ online: true, players, maxPlayers, hostname });
            } catch (err) {
                logger.debug('Failed to parse server query response.', { error: (err as Error).message });
                finish(fallback);
            }
        });

        // Build the query packet
        const ipParts = ip.split('.').map(Number);
        const packet = Buffer.alloc(11);

        packet.write('SAMP', 0, 'ascii');
        packet[4] = ipParts[0] ?? 0;
        packet[5] = ipParts[1] ?? 0;
        packet[6] = ipParts[2] ?? 0;
        packet[7] = ipParts[3] ?? 0;
        packet.writeUInt16LE(port, 8);
        packet[10] = 0x69; // 'i' — info opcode

        socket.send(packet, port, ip, (err) => {
            if (err) {
                clearTimeout(timeout);
                logger.debug('Failed to send server query packet.', { error: err.message });
                finish(fallback);
            }
        });
    });
}