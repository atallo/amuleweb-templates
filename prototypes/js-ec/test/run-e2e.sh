#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Full-stack end-to-end test: starts the mock EC server and the relay, then
# runs the JS client against them (JS client -> WebSocket -> relay -> mock).
set -eu
cd "$(dirname "$0")/.."

MOCK_PORT=4799 python3 test/mock_ec_server.py >/tmp/js-ec-mock.log 2>&1 &
MOCK=$!
sleep 0.6
AMULE_HOST=127.0.0.1 AMULE_PORT=4799 BIND_PORT=8092 python3 relay.py >/tmp/js-ec-relay.log 2>&1 &
RELAY=$!
sleep 1.5

set +e
node test/e2e.mjs
RC=$?
set -e

kill "$MOCK" "$RELAY" 2>/dev/null || true
exit $RC
