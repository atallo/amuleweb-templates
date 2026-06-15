/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * EC tag system: types, encoding and parsing (port of jamule Tag.kt /
 * TagEncoder.kt / TagParser.kt). Wire form of one tag:
 *
 *   [name<<1 | hasSubtags : uint16] [type : uint8] [length : uint32]
 *   [ (if subtags) subtagCount : uint16  subtags... ] [value]
 *
 * Header numbers are binary or UTF-8 per the packet's UTF8 flag. The
 * `length` is always computed with FIXED header sizes (the "theoretical
 * length"), a peculiar but real aMule convention shared by encoder/parser.
 */

import { ECTagType, ECTagName, tagNameFromValue, tagTypeFromValue } from './codes.js';
import * as enc from './encoding.js';

export const TAG_NAME_SIZE = enc.LEN_USHORT;
export const TAG_TYPE_SIZE = enc.LEN_UBYTE;
export const TAG_LENGTH_SIZE = enc.LEN_UINT;
export const SUBTAG_COUNT_SIZE = enc.LEN_USHORT;

const NUMERIC_TYPES = new Set([
	ECTagType.EC_TAGTYPE_UINT8,
	ECTagType.EC_TAGTYPE_UINT16,
	ECTagType.EC_TAGTYPE_UINT32,
	ECTagType.EC_TAGTYPE_UINT64,
]);

export class Tag {
	constructor(name, type, value, subtags = [], nameValue = name) {
		this.name = name;
		this.type = type;
		this.value = value;
		this.subtags = subtags;
		this.nameValue = nameValue;
	}
	isNumeric() { return NUMERIC_TYPES.has(this.type); }
	/** numeric value as a JS Number (u64 coerced; fine for sizes/speeds < 2^53). */
	num() { return typeof this.value === 'bigint' ? Number(this.value) : Number(this.value); }
	big() { return typeof this.value === 'bigint' ? this.value : BigInt(this.value || 0); }
}

/* --- factory helpers (used by request builders) ----------------------- */

export const customTag = (name, bytes, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_CUSTOM, bytes, subtags);
export const ubyteTag = (name, value, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_UINT8, value, subtags);
export const ushortTag = (name, value, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_UINT16, value, subtags);
export const uintTag = (name, value, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_UINT32, value, subtags);
export const ulongTag = (name, value, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_UINT64, value, subtags);
export const stringTag = (name, value, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_STRING, value, subtags);
export const hash16Tag = (name, bytes, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_HASH16, bytes, subtags);
export const ipv4Tag = (name, value, subtags = []) => new Tag(name, ECTagType.EC_TAGTYPE_IPV4, value, subtags);

/* --- value encode/decode per type ------------------------------------- */

const _utf8 = new TextEncoder();
const _utf8dec = new TextDecoder('utf-8');

export function encodeValue(tag) {
	switch (tag.type) {
		case ECTagType.EC_TAGTYPE_CUSTOM:
			return tag.value instanceof Uint8Array ? tag.value : new Uint8Array(tag.value || []);
		case ECTagType.EC_TAGTYPE_UINT8:
			return Uint8Array.of(Number(tag.value) & 0xff);
		case ECTagType.EC_TAGTYPE_UINT16:
			return enc.ushortToBytes(Number(tag.value));
		case ECTagType.EC_TAGTYPE_UINT32:
			return enc.uintToBytes(Number(tag.value));
		case ECTagType.EC_TAGTYPE_UINT64:
			return enc.ulongToBytes(tag.value);
		case ECTagType.EC_TAGTYPE_STRING:
			return enc.concatBytes([_utf8.encode(String(tag.value)), Uint8Array.of(0)]);
		case ECTagType.EC_TAGTYPE_DOUBLE:
			return enc.concatBytes([_utf8.encode(String(Number(tag.value))), Uint8Array.of(0)]);
		case ECTagType.EC_TAGTYPE_IPV4: {
			const ip = tag.value; // { address, port }
			const octets = Uint8Array.from(ip.address.split('.'), (p) => parseInt(p, 10) & 0xff);
			return enc.concatBytes([octets, enc.ushortToBytes(ip.port)]);
		}
		case ECTagType.EC_TAGTYPE_HASH16:
			return tag.value instanceof Uint8Array ? tag.value : new Uint8Array(tag.value);
		default:
			throw new Error('Cannot encode tag type ' + tag.type);
	}
}

function decodeValue(type, data) {
	switch (type) {
		case ECTagType.EC_TAGTYPE_CUSTOM:
			return data;
		case ECTagType.EC_TAGTYPE_UINT8:
			return data.length === 0 ? 0 : data[0];
		case ECTagType.EC_TAGTYPE_UINT16:
			return data.length === 0 ? 0 : enc.bytesToUint16(data);
		case ECTagType.EC_TAGTYPE_UINT32:
			return data.length === 0 ? 0 : enc.bytesToUint32(data);
		case ECTagType.EC_TAGTYPE_UINT64:
			return data.length === 0 ? 0n : enc.bytesToUint64(data);
		case ECTagType.EC_TAGTYPE_STRING: {
			if (data.length === 0 || data[data.length - 1] !== 0x00) {
				throw new Error('StringTag value must be null terminated');
			}
			return _utf8dec.decode(data.subarray(0, data.length - 1));
		}
		case ECTagType.EC_TAGTYPE_DOUBLE:
			return parseFloat(_utf8dec.decode(data).replace(/\0+$/, ''));
		case ECTagType.EC_TAGTYPE_IPV4:
			if (data.length !== 6) throw new Error('Ipv4Tag value must be 6 bytes long');
			return { address: `${data[0]}.${data[1]}.${data[2]}.${data[3]}`, port: enc.bytesToUint16(data.subarray(4)) };
		case ECTagType.EC_TAGTYPE_HASH16:
			if (data.length !== 16) throw new Error('Hash16Tag value must be 16 bytes long');
			return data;
		default:
			// EC_TAGTYPE_UNKNOWN / UINT128 / others: keep raw bytes
			return data;
	}
}

/* --- accessors (port of Packet.Companion find_*) ---------------------- */

function firstByName(tags, name, predicate) {
	for (const t of tags) {
		if (t.name === name) return predicate(t) ? t : undefined;
	}
	return undefined;
}
export const findNumeric = (tags, name) => firstByName(tags, name, (t) => t.isNumeric());
export const findString = (tags, name) => firstByName(tags, name, (t) => t.type === ECTagType.EC_TAGTYPE_STRING);
export const findHash16 = (tags, name) => firstByName(tags, name, (t) => t.type === ECTagType.EC_TAGTYPE_HASH16);
export const findIpv4 = (tags, name) => firstByName(tags, name, (t) => t.type === ECTagType.EC_TAGTYPE_IPV4);
export const findCustom = (tags, name) => firstByName(tags, name, (t) => t.type === ECTagType.EC_TAGTYPE_CUSTOM);
export const findByName = (tags, name) => { for (const t of tags) if (t.name === name) return t; return undefined; };

// convenience numeric reads with a default (mirrors model.py _*_or helpers)
export const numOr = (tags, name, def = 0) => { const t = findNumeric(tags, name); return t ? t.num() : def; };
export const bigOr = (tags, name, def = 0n) => { const t = findNumeric(tags, name); return t ? t.big() : def; };
export const strOr = (tags, name, def = null) => { const t = findString(tags, name); return t ? t.value : def; };

/* --- encoder ---------------------------------------------------------- */

export function encodeTag(tag, utf) {
	const nameAndSub = ((tag.name << 1) | (tag.subtags.length ? 1 : 0)) & 0xffff;
	const headerName = enc.ushortToBytesUtf(nameAndSub, utf);
	const headerLength = enc.uintToBytesUtf(computeTagLength(tag), utf);
	const subtagCount = tag.subtags.length ? enc.ushortToBytesUtf(tag.subtags.length & 0xffff, utf) : new Uint8Array(0);
	const subtagPayload = enc.concatBytes(tag.subtags.map((s) => encodeTag(s, utf)));
	return enc.concatBytes([
		headerName,
		Uint8Array.of(tag.type & 0xff),
		headerLength,
		subtagCount,
		subtagPayload,
		encodeValue(tag),
	]);
}

function computeTagLength(tag) {
	let total = encodeValue(tag).length;
	for (const sub of tag.subtags) {
		total += computeTagLength(sub);
		total += TAG_NAME_SIZE + TAG_TYPE_SIZE + TAG_LENGTH_SIZE;
		if (sub.subtags.length) total += SUBTAG_COUNT_SIZE;
	}
	return total;
}

/* --- parser ----------------------------------------------------------- */

/** Returns { tag, theoretical, endIndex } where endIndex is the tag's last byte. */
export function parseTag(payload, tagNameIndex, utf) {
	const nameAndSub = enc.readUint16(payload, utf, tagNameIndex);
	const tagNameRaw = (nameAndSub >> 1) & 0xffff;
	const tagName = tagNameFromValue(tagNameRaw);
	const hasSubtags = (nameAndSub & 0x01) === 0x01;

	const tagTypeIndex = tagNameIndex + enc.numberLength(payload[tagNameIndex], utf, TAG_NAME_SIZE);
	const tagType = tagTypeFromValue(payload[tagTypeIndex]);

	const tagLengthIndex = tagTypeIndex + TAG_TYPE_SIZE;
	const tagLength = enc.readUint32(payload, utf, tagLengthIndex);

	let valueStart = tagLengthIndex + enc.numberLength(payload[tagLengthIndex], utf, TAG_LENGTH_SIZE);

	const subtags = [];
	let theoretical = 0;
	let valueEnd;

	if (!hasSubtags) {
		valueEnd = valueStart + tagLength - 1;
	} else {
		const subtagCount = enc.readUint16(payload, utf, valueStart);
		valueStart += enc.numberLength(payload[valueStart], utf, SUBTAG_COUNT_SIZE);
		for (let i = 0; i < subtagCount; i++) {
			const r = parseTag(payload, valueStart, utf);
			subtags.push(r.tag);
			valueStart = r.endIndex + 1;
			theoretical += r.theoretical;
		}
		valueEnd = valueStart + (tagLength - theoretical) - 1;
		theoretical += SUBTAG_COUNT_SIZE;
	}

	const tagValueBytes = payload.subarray(valueStart, valueEnd + 1);
	theoretical += tagValueBytes.length;
	theoretical += TAG_NAME_SIZE + TAG_TYPE_SIZE + TAG_LENGTH_SIZE;

	const value = decodeValue(tagType, tagValueBytes);
	const tag = new Tag(tagName, tagType, value, subtags, tagNameRaw);
	return { tag, theoretical, endIndex: valueEnd };
}
