#!/bin/sh
# Copies every object from the old MinIO-backed bucket to the new SeaweedFS-backed
# bucket, verifies the copy, and writes a readable result file back into the OLD
# bucket at _migration-check/result.txt — fetchable via the site's existing public
# /s3/ proxy (no log access needed to check the outcome).
#
# Expects: OLD_S3_ENDPOINT, NEW_S3_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD,
# S3_BUCKET (all passed in as env vars by the compose service).
set -eu

BUCKET="${S3_BUCKET:-shacky-media}"

rclone config create old s3 \
  provider Minio \
  access_key_id "$MINIO_ROOT_USER" \
  secret_access_key "$MINIO_ROOT_PASSWORD" \
  endpoint "$OLD_S3_ENDPOINT" \
  region us-east-1 \
  --non-interactive

rclone config create new s3 \
  provider Other \
  access_key_id "$MINIO_ROOT_USER" \
  secret_access_key "$MINIO_ROOT_PASSWORD" \
  endpoint "$NEW_S3_ENDPOINT" \
  region us-east-1 \
  --non-interactive

RESULT=/tmp/result.txt
echo "Migration started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$RESULT"

echo "--- source (old) ---" >> "$RESULT"
rclone size "old:$BUCKET" >> "$RESULT" 2>&1 || echo "(could not size old bucket)" >> "$RESULT"

echo "--- syncing old -> new ---" >> "$RESULT"
if rclone sync "old:$BUCKET" "new:$BUCKET" -v >> "$RESULT" 2>&1; then
  echo "SYNC_OK" >> "$RESULT"
else
  echo "SYNC_FAILED" >> "$RESULT"
fi

echo "--- destination (new) ---" >> "$RESULT"
rclone size "new:$BUCKET" >> "$RESULT" 2>&1 || echo "(could not size new bucket)" >> "$RESULT"

echo "--- check (old vs new) ---" >> "$RESULT"
if rclone check "old:$BUCKET" "new:$BUCKET" >> "$RESULT" 2>&1; then
  echo "CHECK_PASSED" >> "$RESULT"
  STATUS=0
else
  echo "CHECK_FAILED" >> "$RESULT"
  STATUS=1
fi

echo "Migration finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$RESULT"
cat "$RESULT"

# Upload the result to the OLD bucket (still the live one at this point) so it's
# readable via the public /s3/ proxy without needing container log access.
rclone copyto "$RESULT" "old:$BUCKET/_migration-check/result.txt" || true

exit "$STATUS"
