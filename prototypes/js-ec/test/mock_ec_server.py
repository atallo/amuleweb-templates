#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Mock aMule EC TCP server for end-to-end testing the JS client.

Speaks just enough EC (using the jamule reference codec vendored in the
ec-mobile prototype) to answer the auth handshake and a stats request, so the
full stack -- JS client -> WebSocket -> relay.py -> this server -- can be
exercised without a real aMule. NOT a real aMule: it accepts any password.

Run: MOCK_PORT=4799 python test/mock_ec_server.py   (needs ../../ec-mobile/jamule)
"""
import io
import os
import socket
import sys
import threading
from pathlib import Path

# reuse the vendored jamule reference codec from the sibling prototype
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ec-mobile"))

from jamule.ec.packet import Packet, Flags, PacketWriter, PacketParser  # noqa: E402
from jamule.ec.tag import (  # noqa: E402
    TagEncoder, TagParser, ULongTag, StringTag, UByteTag, UIntTag, Ipv4Tag, Ipv4,
)
from jamule.ec.codes import ECOpCode, ECTagName as N  # noqa: E402

PORT = int(os.environ.get("MOCK_PORT", "4799"))


def build_stats():
    server = Ipv4Tag(N.EC_TAG_SERVER, value=Ipv4("1.2.3.4", 4242), subtags=[
        StringTag(N.EC_TAG_SERVER_NAME, value="eMule Security No1"),
        StringTag(N.EC_TAG_SERVER_DESC, value="Welcome"),
        UIntTag(N.EC_TAG_SERVER_USERS, value=84210),
        UIntTag(N.EC_TAG_SERVER_FILES, value=23400000),
    ])
    conn = UByteTag(N.EC_TAG_CONNSTATE, value=0x05, subtags=[
        UIntTag(N.EC_TAG_ED2K_ID, value=81258542),
        server,
    ])
    return Packet(ECOpCode.EC_OP_STATS, [
        conn,
        ULongTag(N.EC_TAG_STATS_DL_SPEED, value=1530000),
        ULongTag(N.EC_TAG_STATS_UL_SPEED, value=48800),
        UIntTag(N.EC_TAG_STATS_ED2K_USERS, value=84210),
        UIntTag(N.EC_TAG_STATS_KAD_NODES, value=1024),
    ], Flags())


def respond(pkt):
    op = pkt.op_code
    if op == ECOpCode.EC_OP_AUTH_REQ:
        return Packet(ECOpCode.EC_OP_AUTH_SALT, [ULongTag(N.EC_TAG_PASSWD_SALT, value=0x55099A4AEA510C43)])
    if op == ECOpCode.EC_OP_AUTH_PASSWD:
        return Packet(ECOpCode.EC_OP_AUTH_OK, [StringTag(N.EC_TAG_SERVER_VERSION, value="2.3.3-mock")])
    if op == ECOpCode.EC_OP_STAT_REQ:
        return build_stats()
    return Packet(ECOpCode.EC_OP_NOOP, [])


def handle(conn):
    rfile = conn.makefile("rb")
    parser = PacketParser(TagParser())
    writer = PacketWriter(TagEncoder())
    try:
        while True:
            pkt = parser.parse(rfile)
            out = io.BytesIO()
            writer.write(respond(pkt), out)
            conn.sendall(out.getvalue())
    except Exception:
        pass
    finally:
        conn.close()


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", PORT))
    srv.listen(5)
    print(f"mock EC server on 127.0.0.1:{PORT}", flush=True)
    while True:
        conn, _ = srv.accept()
        threading.Thread(target=handle, args=(conn,), daemon=True).start()


if __name__ == "__main__":
    main()
