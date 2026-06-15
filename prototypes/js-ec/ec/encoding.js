/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * EC integer encoding/decoding (port of jamule Encoding.kt / TypeSizes.kt).
 *
 * The quirk: when the EC_FLAG_UTF8_NUMBERS flag is set (the norm), *header*
 * numbers (tag count, tag name, tag length, subtag count) are serialized as
 * the UTF-8 byte sequence of the codepoint whose value is that number --
 * compact for small values. Tag *values* (numeric tags) are always fixed-
 * size big-endian. 64-bit values use BigInt.
 */

export const LEN_UBYTE = 1;
export const LEN_USHORT = 2;
export const LEN_UINT = 4;
export const LEN_ULONG = 8;

const _enc = new TextEncoder();
const _dec = new TextDecoder('utf-8', { fatal: true });

/* --- fixed-size big-endian -------------------------------------------- */

export function ushortToBytes(value) {
	value &= 0xffff;
	return Uint8Array.of((value >>> 8) & 0xff, value & 0xff);
}

export function uintToBytes(value) {
	value = value >>> 0; // to uint32
	return Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

export function ulongToBytes(value) {
	const out = new Uint8Array(8);
	new DataView(out.buffer).setBigUint64(0, BigInt(value) & 0xffffffffffffffffn, false);
	return out;
}

export function bytesToUint64(data) {
	const buf = data.length >= 8 ? data : padLeft(data, 8);
	return new DataView(buf.buffer, buf.byteOffset, 8).getBigUint64(0, false);
}

export function bytesToUint32(data) {
	return (
		((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0
	);
}

export function bytesToUint16(data) {
	return ((data[0] << 8) | data[1]) & 0xffff;
}

function padLeft(data, n) {
	const out = new Uint8Array(n);
	out.set(data, n - data.length);
	return out;
}

/* --- UTF-8 header numbers --------------------------------------------- */

export function numberToUtf8(value) {
	return _enc.encode(String.fromCodePoint(value));
}

export function utf8SequenceLength(firstByte) {
	if ((firstByte & 0x80) === 0) return 1;
	let length = 1;
	let mask = 0x40;
	while ((firstByte & mask) !== 0) {
		length += 1;
		mask >>= 1;
	}
	if (length < 2 || length > 4) {
		throw new Error('Invalid UTF-8 first byte: ' + firstByte);
	}
	return length;
}

export function readUtf8Number(data, offset) {
	const length = utf8SequenceLength(data[offset]);
	return _dec.decode(data.subarray(offset, offset + length)).codePointAt(0);
}

export function numberLength(firstByte, utf, size) {
	return utf ? utf8SequenceLength(firstByte) : size;
}

/* --- header reads (binary or UTF-8) ----------------------------------- */

export function readUint32(data, utf, index) {
	if (!utf) return bytesToUint32(data.subarray(index, index + LEN_UINT));
	return readUtf8Number(data, index);
}

export function readUint16(data, utf, index) {
	if (!utf) return bytesToUint16(data.subarray(index, index + LEN_USHORT));
	return readUtf8Number(data, index);
}

export function ushortToBytesUtf(value, utf) {
	return utf ? numberToUtf8(value & 0xffff) : ushortToBytes(value);
}

export function uintToBytesUtf(value, utf) {
	return utf ? numberToUtf8(value >>> 0) : uintToBytes(value);
}

/* --- byte helpers ----------------------------------------------------- */

export function concatBytes(chunks) {
	let total = 0;
	for (const c of chunks) total += c.length;
	const out = new Uint8Array(total);
	let off = 0;
	for (const c of chunks) { out.set(c, off); off += c.length; }
	return out;
}
