/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * EC request builders (port of jamule request.py). Each returns a Packet.
 */

import { ECOpCode, ECTagName, ECDetailLevel, ECSearchType, EcPrefs, ProtocolVersion } from './codes.js';
import { Packet, Flags } from './packet.js';
import { stringTag, ubyteTag, ushortTag, uintTag, ulongTag, hash16Tag, customTag } from './tag.js';

export const CLIENT_NAME = 'jAmule';
export const CLIENT_VERSION = 'for amule 2.3.3';

export const SearchType = {
	GLOBAL: ECSearchType.EC_SEARCH_GLOBAL,
	KAD: ECSearchType.EC_SEARCH_KAD,
	LOCAL: ECSearchType.EC_SEARCH_LOCAL,
	WEB: ECSearchType.EC_SEARCH_WEB,
};

// download commands -> the opcode used as the packet's opcode
export const DownloadCommand = {
	pause: ECOpCode.EC_OP_PARTFILE_PAUSE,
	resume: ECOpCode.EC_OP_PARTFILE_RESUME,
	stop: ECOpCode.EC_OP_PARTFILE_STOP,
	cancel: ECOpCode.EC_OP_PARTFILE_DELETE,
	delete: ECOpCode.EC_OP_PARTFILE_DELETE,
};

export const saltRequest = () => new Packet(ECOpCode.EC_OP_AUTH_REQ, [
	stringTag(ECTagName.EC_TAG_CLIENT_NAME, CLIENT_NAME),
	stringTag(ECTagName.EC_TAG_CLIENT_VERSION, CLIENT_VERSION),
	ushortTag(ECTagName.EC_TAG_PROTOCOL_VERSION, ProtocolVersion.EC_CURRENT_PROTOCOL_VERSION),
	customTag(ECTagName.EC_TAG_CAN_ZLIB, new Uint8Array(0)),
	customTag(ECTagName.EC_TAG_CAN_UTF8_NUMBERS, new Uint8Array(0)),
], new Flags());

export const authRequest = (hashedPassword) => new Packet(ECOpCode.EC_OP_AUTH_PASSWD, [
	hash16Tag(ECTagName.EC_TAG_PASSWD_HASH, hashedPassword),
], new Flags());

export const statsRequest = () => new Packet(ECOpCode.EC_OP_STAT_REQ, [
	ubyteTag(ECTagName.EC_TAG_DETAIL_LEVEL, ECDetailLevel.EC_DETAIL_FULL),
], new Flags());

export const downloadQueueRequest = () => new Packet(ECOpCode.EC_OP_GET_DLOAD_QUEUE, [
	ubyteTag(ECTagName.EC_TAG_DETAIL_LEVEL, ECDetailLevel.EC_DETAIL_FULL),
], new Flags());

export const sharedFilesRequest = () => new Packet(ECOpCode.EC_OP_GET_SHARED_FILES, [
	ubyteTag(ECTagName.EC_TAG_DETAIL_LEVEL, ECDetailLevel.EC_DETAIL_FULL),
], new Flags());

export const addLinkRequest = (link) => new Packet(ECOpCode.EC_OP_ADD_LINK, [
	stringTag(ECTagName.EC_TAG_PARTFILE_ED2K_LINK, link),
], new Flags());

export const searchStatusRequest = () => new Packet(ECOpCode.EC_OP_SEARCH_PROGRESS, [], new Flags());
export const searchResultsRequest = () => new Packet(ECOpCode.EC_OP_SEARCH_RESULTS, [], new Flags());
export const searchStopRequest = () => new Packet(ECOpCode.EC_OP_SEARCH_STOP, [], new Flags());

export const getPreferencesRequest = (prefs) => new Packet(ECOpCode.EC_OP_GET_PREFERENCES, [
	ubyteTag(ECTagName.EC_TAG_DETAIL_LEVEL, ECDetailLevel.EC_DETAIL_FULL),
	uintTag(ECTagName.EC_TAG_SELECT_PREFS, prefs),
], new Flags());

export const downloadCommandRequest = (fileHash, opcode) => new Packet(opcode, [
	hash16Tag(ECTagName.EC_TAG_PARTFILE, fileHash),
], new Flags());

export const downloadSearchResultRequest = (fileHash) => new Packet(ECOpCode.EC_OP_DOWNLOAD_SEARCH_RESULT, [
	hash16Tag(ECTagName.EC_TAG_PARTFILE, fileHash),
], new Flags());

export const setFileCategoryRequest = (fileHash, category) => new Packet(ECOpCode.EC_OP_PARTFILE_SET_CAT, [
	hash16Tag(ECTagName.EC_TAG_PARTFILE, fileHash, [
		ulongTag(ECTagName.EC_TAG_PARTFILE_CAT, BigInt(category)),
	]),
], new Flags());

/**
 * EC_OP_SEARCH_START. The name is a subtag of the search-type tag; optional
 * filters are sibling tags at the root.
 * @param {string} query
 * @param {number} type SearchType.*
 * @param {{minSize?:number|bigint,maxSize?:number|bigint,availability?:number,fileType?:string,extension?:string}} filters
 */
export function searchRequest(query, type, filters = {}) {
	const tags = [
		ubyteTag(ECTagName.EC_TAG_SEARCH_TYPE, type, [
			stringTag(ECTagName.EC_TAG_SEARCH_NAME, query),
		]),
	];
	if (filters.fileType != null) tags.push(stringTag(ECTagName.EC_TAG_SEARCH_FILE_TYPE, filters.fileType));
	if (filters.extension != null) tags.push(stringTag(ECTagName.EC_TAG_SEARCH_EXTENSION, filters.extension));
	if (filters.minSize != null) tags.push(ulongTag(ECTagName.EC_TAG_SEARCH_MIN_SIZE, BigInt(filters.minSize)));
	if (filters.maxSize != null) tags.push(ulongTag(ECTagName.EC_TAG_SEARCH_MAX_SIZE, BigInt(filters.maxSize)));
	if (filters.availability != null) tags.push(ulongTag(ECTagName.EC_TAG_SEARCH_AVAILABILITY, BigInt(filters.availability)));
	return new Packet(ECOpCode.EC_OP_SEARCH_START, tags, new Flags());
}
