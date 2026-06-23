#!/bin/sh

echo "=== API DEBUG ==="
echo "DB host: $(echo "${DATABASE_URL:-UNSET}" | sed 's|.*@||' | cut -d/ -f1)"
echo "shared/dist: $(ls node_modules/@shacky/shared/dist/ 2>&1 | head -3)"
echo "schema-engine: $(ls node_modules/@prisma/engines/schema-engine* 2>&1 | head -2)"
echo "dist/server.js: $(ls dist/server.js 2>&1)"
echo "=== END DEBUG ==="

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy
MIGRATE_EXIT=$?

if [ "$MIGRATE_EXIT" -ne 0 ]; then
  echo "MIGRATION FAILED (exit $MIGRATE_EXIT) — sleeping 600s"
  sleep 600
  exit 1
fi

echo "Starting API server..."
node dist/server.js
NODE_EXIT=$?
echo "SERVER EXITED (exit $NODE_EXIT) — sleeping 600s"
sleep 600
exit "$NODE_EXIT"
