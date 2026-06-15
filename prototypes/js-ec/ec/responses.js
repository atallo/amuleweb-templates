/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * EC response parsing + domain models (port of jamule response.py / model.py).
 * parseResponse(packet) dispatches on the opcode and returns a plain object
 * with a `type` discriminator.
 */

import { ECOpCode, ECTagName, ECTagType, ECSearchFileDownloadStatus } from './codes.js';
import {
	findByName, findString, findHash16, findIpv4, findNumeric,
	numOr, bigOr, strOr,
} from './tag.js';
import { toHex } from './md5.js';

const FILE_STATUS = {
	0: 'Ready', 1: 'Empty', 2: 'Waiting for hash', 3: 'Hashing', 4: 'Error',
	5: 'Insufficient', 6: 'Unknown', 7: 'Paused', 8: 'Completing', 9: 'Complete', 10: 'Allocating',
};

const signedByte = (v) => (v >= 128 ? v - 256 : v);
const byteOr = (tags, name, def = 0) => {
	const t = findByName(tags, name);
	return t && t.type === ECTagType.EC_TAGTYPE_UINT8 ? t.num() : def;
};
const hashHex = (tags, name) => { const t = findHash16(tags, name); return t ? toHex(t.value) : null; };

/* --- file models ------------------------------------------------------ */

function sharedFileFromSubtags(st) {
	return {
		hash: hashHex(st, ECTagName.EC_TAG_PARTFILE_HASH),
		name: strOr(st, ECTagName.EC_TAG_PARTFILE_NAME),
		path: strOr(st, ECTagName.EC_TAG_KNOWNFILE_FILENAME),
		sizeFull: Number(bigOr(st, ECTagName.EC_TAG_PARTFILE_SIZE_FULL)),
		ed2kLink: strOr(st, ECTagName.EC_TAG_PARTFILE_ED2K_LINK),
		upPrio: signedByte(byteOr(st, ECTagName.EC_TAG_KNOWNFILE_PRIO)),
		requests: numOr(st, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT),
		requestsAll: numOr(st, ECTagName.EC_TAG_KNOWNFILE_REQ_COUNT_ALL),
		accepts: numOr(st, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT),
		acceptsAll: numOr(st, ECTagName.EC_TAG_KNOWNFILE_ACCEPT_COUNT_ALL),
		xferred: Number(bigOr(st, ECTagName.EC_TAG_KNOWNFILE_XFERRED)),
		xferredAll: Number(bigOr(st, ECTagName.EC_TAG_KNOWNFILE_XFERRED_ALL)),
		completeSources: numOr(st, ECTagName.EC_TAG_KNOWNFILE_COMPLETE_SOURCES),
	};
}

function partFileFromSubtags(st) {
	const base = sharedFileFromSubtags(st);
	const statusValue = byteOr(st, ECTagName.EC_TAG_PARTFILE_STATUS, 6);
	const stopped = byteOr(st, ECTagName.EC_TAG_PARTFILE_STOPPED) !== 0;
	return {
		...base,
		sizeFull: Number(bigOr(st, ECTagName.EC_TAG_PARTFILE_SIZE_FULL)),
		sizeXfer: Number(bigOr(st, ECTagName.EC_TAG_PARTFILE_SIZE_XFER)),
		sizeDone: Number(bigOr(st, ECTagName.EC_TAG_PARTFILE_SIZE_DONE)),
		speed: Number(bigOr(st, ECTagName.EC_TAG_PARTFILE_SPEED)),
		statusValue,
		status: stopped ? 'Paused' : (FILE_STATUS[statusValue] || 'Unknown'),
		stopped,
		sourceCount: numOr(st, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT),
		sourceNotCurrCount: numOr(st, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_NOT_CURRENT),
		sourceXferCount: numOr(st, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_XFER),
		sourceCountA4af: numOr(st, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_A4AF),
		downPrio: signedByte(byteOr(st, ECTagName.EC_TAG_PARTFILE_PRIO)),
		category: Number(bigOr(st, ECTagName.EC_TAG_PARTFILE_CAT)),
	};
}

function searchFileFrom(st) {
	const statusByte = byteOr(st, ECTagName.EC_TAG_PARTFILE_STATUS, 0);
	return {
		hash: hashHex(st, ECTagName.EC_TAG_PARTFILE_HASH),
		name: strOr(st, ECTagName.EC_TAG_PARTFILE_NAME),
		sizeFull: Number(bigOr(st, ECTagName.EC_TAG_PARTFILE_SIZE_FULL)),
		sourceCount: numOr(st, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT),
		completeSourceCount: numOr(st, ECTagName.EC_TAG_PARTFILE_SOURCE_COUNT_XFER),
		downloadStatus: ECSearchFileDownloadStatus[statusByte] || 'NEW',
	};
}

/* --- connection / stats ----------------------------------------------- */

function connectionStateFrom(connTag) {
	const byte = connTag.type === ECTagType.EC_TAGTYPE_UINT8 ? connTag.num() : 0;
	const serverTag = findByName(connTag.subtags, ECTagName.EC_TAG_SERVER);
	let server = null;
	if (serverTag && serverTag.type === ECTagType.EC_TAGTYPE_IPV4) {
		const ip = serverTag.value; // { address, port }
		server = {
			address: `${ip.address}:${ip.port}`,
			name: strOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_NAME)
				|| strOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_DESC),
			description: strOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_DESC),
			users: numOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_USERS, null),
			usersMax: numOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_USERS_MAX, null),
			files: numOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_FILES, null),
			ping: numOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_PING, null),
			version: strOr(serverTag.subtags, ECTagName.EC_TAG_SERVER_VERSION),
		};
	}
	return {
		ed2kConnected: (byte & 0x01) !== 0,
		ed2kConnecting: (byte & 0x02) !== 0,
		kadConnected: (byte & 0x04) !== 0,
		kadFirewalled: (byte & 0x08) !== 0,
		kadRunning: (byte & 0x10) !== 0,
		ed2kId: numOr(connTag.subtags, ECTagName.EC_TAG_ED2K_ID, null),
		kadId: numOr(connTag.subtags, ECTagName.EC_TAG_KAD_ID, null),
		clientId: numOr(connTag.subtags, ECTagName.EC_TAG_CLIENT_ID, null),
		server,
	};
}

function parseStats(packet) {
	const connTag = findByName(packet.tags, ECTagName.EC_TAG_CONNSTATE);
	return {
		type: 'stats',
		connection: connTag ? connectionStateFrom(connTag) : null,
		uploadSpeed: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_UL_SPEED)),
		downloadSpeed: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_DL_SPEED)),
		uploadSpeedLimit: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_UL_SPEED_LIMIT)),
		downloadSpeedLimit: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_DL_SPEED_LIMIT)),
		ed2kUsers: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_ED2K_USERS)),
		kadUsers: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_KAD_USERS)),
		ed2kFiles: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_ED2K_FILES)),
		kadFiles: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_KAD_FILES)),
		kadNodes: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_KAD_NODES)),
		sharedFileCount: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_SHARED_FILE_COUNT)),
		totalSent: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_SENT_BYTES)),
		totalReceived: Number(bigOr(packet.tags, ECTagName.EC_TAG_STATS_TOTAL_RECEIVED_BYTES)),
	};
}

function parseSearchStatus(packet) {
	const t = findNumeric(packet.tags, ECTagName.EC_TAG_SEARCH_STATUS);
	const num = t ? t.num() : 0;
	// local searches return 0xFFFF, Kad returns 0xFFFE when finished
	const status = num === 0xffff || num === 0xfffe ? 1.0 : num / 100.0;
	return { type: 'searchStatus', status };
}

function parseCategories(packet) {
	const container = findByName(packet.tags, ECTagName.EC_TAG_PREFS_CATEGORIES);
	const categories = [];
	if (container) {
		for (const cat of container.subtags) {
			if (cat.name !== ECTagName.EC_TAG_CATEGORY) continue;
			categories.push({
				id: cat.isNumeric() ? cat.num() : 0,
				name: strOr(cat.subtags, ECTagName.EC_TAG_CATEGORY_TITLE),
				path: strOr(cat.subtags, ECTagName.EC_TAG_CATEGORY_PATH),
			});
		}
	}
	return { type: 'categories', categories };
}

/* --- dispatcher ------------------------------------------------------- */

export function parseResponse(packet) {
	const op = packet.opCode;
	switch (op) {
		case ECOpCode.EC_OP_AUTH_FAIL:
			return { type: 'authFail', reason: strOr(packet.tags, ECTagName.EC_TAG_STRING) };
		case ECOpCode.EC_OP_AUTH_OK:
			return { type: 'authOk', version: strOr(packet.tags, ECTagName.EC_TAG_SERVER_VERSION) };
		case ECOpCode.EC_OP_AUTH_SALT: {
			const t = findNumeric(packet.tags, ECTagName.EC_TAG_PASSWD_SALT);
			return { type: 'salt', salt: t ? t.big() : 0n };
		}
		case ECOpCode.EC_OP_DLOAD_QUEUE:
			return {
				type: 'downloadQueue',
				partFiles: packet.tags
					.filter((t) => t.name === ECTagName.EC_TAG_PARTFILE)
					.map((t) => partFileFromSubtags(t.subtags)),
			};
		case ECOpCode.EC_OP_SHARED_FILES:
			return {
				type: 'sharedFiles',
				files: packet.tags
					.filter((t) => t.name === ECTagName.EC_TAG_KNOWNFILE)
					.map((t) => sharedFileFromSubtags(t.subtags)),
			};
		case ECOpCode.EC_OP_SEARCH_RESULTS:
			return {
				type: 'searchResults',
				files: packet.tags
					.filter((t) => t.name === ECTagName.EC_TAG_SEARCHFILE)
					.map((t) => searchFileFrom(t.subtags)),
			};
		case ECOpCode.EC_OP_SEARCH_PROGRESS:
			return parseSearchStatus(packet);
		case ECOpCode.EC_OP_STATS:
			return parseStats(packet);
		case ECOpCode.EC_OP_STRINGS:
			return { type: 'strings', string: strOr(packet.tags, ECTagName.EC_TAG_STRING) || '' };
		case ECOpCode.EC_OP_MISC_DATA:
			return { type: 'misc' };
		case ECOpCode.EC_OP_NOOP:
			return { type: 'noop' };
		case ECOpCode.EC_OP_FAILED:
			return { type: 'error', message: strOr(packet.tags, ECTagName.EC_TAG_STRING) || 'Unknown error' };
		case ECOpCode.EC_OP_SET_PREFERENCES:
			return parseCategories(packet);
		default:
			return { type: 'unknown', opCode: op, packet };
	}
}
