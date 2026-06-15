/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * Barrel module for the JavaScript aMule EC client library. Import everything
 * you need from here:
 *
 *   import { AmuleClient, SearchType, DownloadCommand } from './ec/index.js';
 *   const client = await AmuleClient.connect('ws://localhost:8092/ec', 'secret');
 *   const stats = await client.getStats();
 */

export { AmuleClient, SearchType, DownloadCommand, hexToBytes } from './client.js';
export { WebSocketTransport } from './transport.js';
export { parseResponse } from './responses.js';
export { Packet, Flags, writePacket, frame, decodePayload } from './packet.js';
export { md5, hashPassword, toHex } from './md5.js';
export * as codes from './codes.js';
export * as requests from './requests.js';
