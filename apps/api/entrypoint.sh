#!/bin/sh
set -e
echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy
echo "Seeding database..."
node dist/seed.js
echo "Starting API server..."
exec node dist/server.js
