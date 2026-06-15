/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 atallo (https://github.com/atallo/amuleweb-templates)
 *
 * MD5 (RFC 1321) over byte arrays. The Web Crypto API does NOT provide MD5,
 * so the EC password hash (which aMule builds from MD5) needs this. Compact,
 * dependency-free, operates on and returns Uint8Array.
 */

// per-round left-rotate amounts
const S = [
	7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
	5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
	4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
	6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
// K[i] = floor(2^32 * abs(sin(i+1)))
const K = (() => {
	const k = new Uint32Array(64);
	for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
	return k;
})();

const rotl = (x, c) => ((x << c) | (x >>> (32 - c))) >>> 0;

/** @param {Uint8Array} bytes  @returns {Uint8Array} 16-byte digest */
export function md5(bytes) {
	const originalLenBits = bytes.length * 8;
	// pad: 0x80, then zeros to 56 mod 64, then 64-bit little-endian bit length
	const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
	padded.set(bytes);
	padded[bytes.length] = 0x80;
	const dv = new DataView(padded.buffer);
	dv.setUint32(padded.length - 8, originalLenBits >>> 0, true);
	dv.setUint32(padded.length - 4, Math.floor(originalLenBits / 0x100000000) >>> 0, true);

	let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
	const M = new Uint32Array(16);

	for (let off = 0; off < padded.length; off += 64) {
		for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
		let A = a0, B = b0, C = c0, D = d0;
		for (let i = 0; i < 64; i++) {
			let F, g;
			if (i < 16) { F = (B & C) | (~B & D); g = i; }
			else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
			else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
			else { F = C ^ (B | (~D >>> 0)); g = (7 * i) & 15; }
			F = (F + A + K[i] + M[g]) >>> 0;
			A = D; D = C; C = B;
			B = (B + rotl(F, S[i])) >>> 0;
		}
		a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
	}

	const out = new Uint8Array(16);
	const odv = new DataView(out.buffer);
	odv.setUint32(0, a0, true);
	odv.setUint32(4, b0, true);
	odv.setUint32(8, c0, true);
	odv.setUint32(12, d0, true);
	return out;
}

export function toHex(bytes) {
	let s = '';
	for (const b of bytes) s += b.toString(16).padStart(2, '0');
	return s;
}

const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);
const utf8 = (s) => new TextEncoder().encode(s);

/**
 * The aMule EC password hash (port of jamule PasswordHasher.kt):
 *   salt_hash     = MD5( uppercase 16-hex of salt )
 *   password_hash = MD5( password utf-8 )
 *   result        = MD5( hex(password_hash).lower + hex(salt_hash).lower )
 * @param {string} password  @param {bigint} salt  @returns {Uint8Array} 16 bytes
 */
export function hashPassword(password, salt) {
	const saltHexUpper = (salt & 0xffffffffffffffffn).toString(16).toUpperCase().padStart(16, '0');
	const saltHash = md5(ascii(saltHexUpper));
	const passwordHash = md5(utf8(password));
	const combined = ascii(toHex(passwordHash) + toHex(saltHash));
	return md5(combined);
}
