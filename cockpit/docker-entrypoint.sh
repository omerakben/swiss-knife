#!/bin/sh
set -e
echo "Applying database schema..."
# Prisma 7: --skip-generate was removed, and the datasource URL + schema path
# come from prisma.config.ts (copied into the image) reading DATABASE_URL.
npx prisma db push
exec "$@"
