/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * EC packet layer (port of jamule Flags.kt / Packet.kt / PacketWriter.kt /
 * PacketParser.kt). On the wire:
 *
 *   [flags : uint32] [ (if accepts) acceptFlags : uint32 ] [length : uint32] [payload]
 *   payload = [opcode : uint8] [tagCount : uint16] [tags...]   (maybe zlib'd)
 *
 * Writing never compresses (aMule accepts plain requests). Reading splits
 * framing (sync) from payload decode (async, because zlib uses the native
 * DecompressionStream).
 */

import { ECFlag, ECOpCode, ECTagName, OP_CODE_BY_VALUE } from './codes.js';
import * as enc from './encoding.js';
import { encodeTag, parseTag } from './tag.js';

const MAX_DECOMPRESSED = 50 * 1024 * 1024;

export class Flags {
	constructor({ zlib = false, utf8 = true, hasId = false, accepts = false } = {}) {
		this.zlib = zlib;
		this.utf8 = utf8;
		this.hasId = hasId;
		this.accepts = accepts;
	}
	toUint() {
		let f = 0x20; // bit 5 always set (distinguishes from pre-rc8 clients)
		if (this.zlib) f |= ECFlag.EC_FLAG_ZLIB;
		if (this.utf8) f |= ECFlag.EC_FLAG_UTF8_NUMBERS;
		if (this.hasId) f |= ECFlag.EC_FLAG_HAS_ID;
		if (this.accepts) f |= ECFlag.EC_FLAG_ACCEPTS;
		return f >>> 0;
	}
	static fromUint(f) {
		return new Flags({
			zlib: (f & ECFlag.EC_FLAG_ZLIB) !== 0,
			utf8: (f & ECFlag.EC_FLAG_UTF8_NUMBERS) !== 0,
			hasId: (f & ECFlag.EC_FLAG_HAS_ID) !== 0,
			accepts: (f & ECFlag.EC_FLAG_ACCEPTS) !== 0,
		});
	}
}

export class Packet {
	constructor(opCode, tags = [], flags = new Flags(), accepts = null) {
		this.opCode = opCode;
		this.tags = tags;
		this.flags = flags;
		this.accepts = accepts;
	}
}

/* --- writing ---------------------------------------------------------- */

export function writePacket(packet) {
	const parts = [enc.uintToBytes(packet.flags.toUint())];
	if (packet.flags.accepts) {
		if (!packet.accepts) throw new Error('Accepts flags required when accepts flag set');
		parts.push(enc.uintToBytes(packet.accepts.toUint()));
	}
	const payload = encodePayload(packet); // never compressed on write
	parts.push(enc.uintToBytes(payload.length));
	parts.push(payload);
	return enc.concatBytes(parts);
}

function encodePayload(packet) {
	const opcode = Uint8Array.of(packet.opCode & 0xff);
	const tagCount = enc.ushortToBytesUtf(packet.tags.length & 0xffff, packet.flags.utf8);
	const tags = enc.concatBytes(packet.tags.map((t) => encodeTag(t, packet.flags.utf8)));
	return enc.concatBytes([opcode, tagCount, tags]);
}

/* --- reading: framing (sync) ----------------------------------------- */

/**
 * Try to split one complete packet off the front of `buffer`.
 * @returns {{flags:Flags, accepts:Flags|null, payloadRaw:Uint8Array, consumed:number}|null}
 *          null if the buffer does not yet hold a full packet.
 */
export function frame(buffer) {
	let off = 0;
	if (buffer.length < off + 4) return null;
	const flagsU = enc.bytesToUint32(buffer.subarray(off, off + 4));
	if ((flagsU & ECFlag.EC_FLAG_UNKNOWN_MASK) !== 0) throw new Error('Unknown transmission flags');
	const flags = Flags.fromUint(flagsU);
	off += 4;

	let accepts = null;
	if (flags.accepts) {
		if (buffer.length < off + 4) return null;
		accepts = Flags.fromUint(enc.bytesToUint32(buffer.subarray(off, off + 4)));
		off += 4;
	}

	if (buffer.length < off + 4) return null;
	const length = enc.bytesToUint32(buffer.subarray(off, off + 4));
	off += 4;
	if (length === 0) throw new Error('Payload cannot be empty');

	if (buffer.length < off + length) return null; // payload not fully arrived
	const payloadRaw = buffer.subarray(off, off + length);
	return { flags, accepts, payloadRaw, consumed: off + length };
}

/* --- reading: payload decode (async because of zlib) ------------------ */

export async function decodePayload(flags, accepts, payloadRaw) {
	const payload = flags.zlib ? await inflate(payloadRaw) : payloadRaw;
	const utf = flags.utf8;
	const opCode = payload[0];
	const tagCount = enc.readUint16(payload, utf, 1);
	let index = 1 + enc.numberLength(payload[1], utf, enc.LEN_USHORT);

	const tags = [];
	let counter = 0;
	while (index < payload.length && counter < tagCount) {
		const r = parseTag(payload, index, utf);
		tags.push(r.tag);
		index = r.endIndex + 1;
		counter += 1;
	}
	if (index !== payload.length) {
		throw new Error(`Invalid tags size: expected ${payload.length} found ${index}`);
	}
	if (counter !== tagCount) {
		throw new Error(`Expected ${tagCount} tags, found ${counter}`);
	}
	return new Packet(opCode, tags, flags, accepts);
}

async function inflate(bytes) {
	const ds = new DecompressionStream('deflate'); // RFC1950 zlib, as aMule emits
	const writer = ds.writable.getWriter();
	writer.write(bytes);
	writer.close();
	const reader = ds.readable.getReader();
	const chunks = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		total += value.length;
		if (total > MAX_DECOMPRESSED) throw new Error('Decompressed payload too large');
	}
	return enc.concatBytes(chunks);
}

export const opCodeName = (op) => OP_CODE_BY_VALUE[op] || ('0x' + op.toString(16));
