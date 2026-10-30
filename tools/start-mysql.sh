#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Local MySQL 8 for the HealthGuard sandbox (no root / no systemd).
# The MySQL server binaries are unpacked under tools/mysql from the
# official Ubuntu packages (mysql-server-core-8.0).
#
#   ./tools/start-mysql.sh        # start (idempotent)
#   ./tools/start-mysql.sh stop   # stop
#   ./tools/start-mysql.sh status # check connectivity
# ---------------------------------------------------------------------
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="$ROOT/tools"
export LD_LIBRARY_PATH="$BASE/mysql/usr/lib/x86_64-linux-gnu:$BASE/mysql/lib/x86_64-linux-gnu"
SOCK="$BASE/mysql/run/mysqld.sock"

running() { "$BASE/mysql/usr/bin/mysql" --no-defaults --socket="$SOCK" -uroot -e "SELECT 1" >/dev/null 2>&1; }

case "${1:-start}" in
  start)
    if running; then echo "mysqld already running ($SOCK)"; exit 0; fi
    mkdir -p "$BASE/mysql/data" "$BASE/mysql/run" "$BASE/mysql/files"
    if [ ! -d "$BASE/mysql/data/healthguard" ] && [ ! -f "$BASE/mysql/data/mysql" ]; then
      "$BASE/mysql/usr/sbin/mysqld" --no-defaults --initialize-insecure \
        --basedir="$BASE/mysql/usr" --datadir="$BASE/mysql/data"
    fi
    "$BASE/mysql/usr/sbin/mysqld" --no-defaults \
      --basedir="$BASE/mysql/usr" --datadir="$BASE/mysql/data" \
      --socket="$SOCK" --port=3306 --bind-address=127.0.0.1 --mysqlx=OFF \
      --secure-file-priv="$BASE/mysql/files" --pid-file="$BASE/mysql/run/mysqld.pid" \
      --log-error="$BASE/mysql/data/mysqld.err" >>"$BASE/mysql/data/mysqld.out" 2>&1 &
    for _ in $(seq 1 30); do running && { echo "mysqld started ($SOCK)"; exit 0; }; sleep 1; done
    echo "mysqld failed to start - see $BASE/mysql/data/mysqld.err" >&2
    exit 1
    ;;
  stop)
    [ -f "$BASE/mysql/run/mysqld.pid" ] && kill "$(cat "$BASE/mysql/run/mysqld.pid")" && echo "mysqld stopped" || echo "mysqld not running"
    ;;
  status)
    running && echo "mysqld running" || { echo "mysqld not running"; exit 1; }
    ;;
esac
