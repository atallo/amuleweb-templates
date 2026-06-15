/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Byte-for-byte parity test of the JS EC codec against the Python jamule
 * reference (atallo/amarr). Run: node test/parity.mjs
 */
import { ECOpCode, ECTagName, ECDetailLevel, ECSearchType } from '../ec/codes.js';
import { Packet, Flags, writePacket, frame, decodePayload } from '../ec/packet.js';
import { stringTag, ubyteTag, ushortTag, ulongTag, customTag, findString, findNumeric } from '../ec/tag.js';
import { hashPassword, toHex } from '../ec/md5.js';
import { parseResponse } from '../ec/responses.js';

const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

// reference values produced by Python jamule (see commit message / README)
const REF = {
	SALT: '000000220000002c0205c88006076a416d756c6500c8820610666f7220616d756c6520322e332e330004030202041801001a0100',
	STATS: '00000022000000060a0108020102',
	SEARCH: '000000220000002f2603e0b883020f01e0b884060773696e74656c0001e0b886050800000000000f4240e0b888050800000000001e8480',
	PW: '0d87669c3f959f4d671bcf7e34f866ca',
	PW2: '5f57a8d1b73a15d33156e63f3b08b67d',
};

let fails = 0;
function eq(name, got, want) {
	const ok = got === want;
	if (!ok) fails++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
	if (!ok) { console.log('   got : ' + got); console.log('   want: ' + want); }
}

// salt_request
const saltPkt = new Packet(ECOpCode.EC_OP_AUTH_REQ, [
	stringTag(ECTagName.EC_TAG_CLIENT_NAME, 'jAmule'),
	stringTag(ECTagName.EC_TAG_CLIENT_VERSION, 'for amule 2.3.3'),
	ushortTag(ECTagName.EC_TAG_PROTOCOL_VERSION, 0x0204),
	customTag(ECTagName.EC_TAG_CAN_ZLIB, new Uint8Array(0)),
	customTag(ECTagName.EC_TAG_CAN_UTF8_NUMBERS, new Uint8Array(0)),
], new Flags());
eq('encode salt_request', hex(writePacket(saltPkt)), REF.SALT);

// stats_request
const statsPkt = new Packet(ECOpCode.EC_OP_STAT_REQ, [
	ubyteTag(ECTagName.EC_TAG_DETAIL_LEVEL, ECDetailLevel.EC_DETAIL_FULL),
], new Flags());
eq('encode stats_request', hex(writePacket(statsPkt)), REF.STATS);

// search_request (nested subtag + ulong filters)
const searchPkt = new Packet(ECOpCode.EC_OP_SEARCH_START, [
	ubyteTag(ECTagName.EC_TAG_SEARCH_TYPE, ECSearchType.EC_SEARCH_GLOBAL, [
		stringTag(ECTagName.EC_TAG_SEARCH_NAME, 'sintel'),
	]),
	ulongTag(ECTagName.EC_TAG_SEARCH_MIN_SIZE, 1000000n),
	ulongTag(ECTagName.EC_TAG_SEARCH_MAX_SIZE, 2000000n),
], new Flags());
eq('encode search_request', hex(writePacket(searchPkt)), REF.SEARCH);

// password hashing (known jamule vector + non-ASCII)
eq('hashPassword vector', toHex(hashPassword('test', 0x55099a4aea510c43n)), REF.PW);
eq('hashPassword utf8', toHex(hashPassword('amule-ñ', 0x0102030405060708n)), REF.PW2);

// round-trip parse: encode -> frame -> decode -> compare tags
const rt = frame(writePacket(searchPkt));
const decoded = await decodePayload(rt.flags, rt.accepts, rt.payloadRaw);
eq('round-trip opcode', String(decoded.opCode), String(ECOpCode.EC_OP_SEARCH_START));
const typeTag = decoded.tags[0];
eq('round-trip nested name', findString(typeTag.subtags, ECTagName.EC_TAG_SEARCH_NAME).value, 'sintel');
eq('round-trip ulong min', String(findNumeric(decoded.tags, ECTagName.EC_TAG_SEARCH_MIN_SIZE).big()), '1000000');
eq('round-trip ulong max', String(findNumeric(decoded.tags, ECTagName.EC_TAG_SEARCH_MAX_SIZE).big()), '2000000');

// response parsing: a synthetic STATS packet built by Python jamule. Exercises
// connstate flags + nested ed2k_id + the server tag (IPv4 value AND subtags).
const STATS_RESP = '00000022000000790c050b025a020c040404d7e82ee0a881084504e0a8820613654d756c65205365637572697479204e6f3100e0a884060857656c636f6d6500e0a88a0404000148f2e0a88e040401650e4001020304109205d08205080000000000175890d0800508000000000000bea0d0920404000148f2d0b6040400000400';
const sb = Uint8Array.from(STATS_RESP.match(/../g).map((h) => parseInt(h, 16)));
const sfr = frame(sb);
const stats = parseResponse(await decodePayload(sfr.flags, sfr.accepts, sfr.payloadRaw));
eq('stats ed2k connected', String(stats.connection.ed2kConnected), 'true');
eq('stats ed2k id', String(stats.connection.ed2kId), '81258542');
eq('stats server addr', stats.connection.server.address, '1.2.3.4:4242');
eq('stats server users', String(stats.connection.server.users), '84210');
eq('stats download speed', String(stats.downloadSpeed), '1530000');
eq('stats kad nodes', String(stats.kadNodes), '1024');

console.log(fails === 0 ? '\nAll parity checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
