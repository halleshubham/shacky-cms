#!/bin/sh
# Copies every object from the old MinIO-backed bucket to the new SeaweedFS-backed
# bucket, verifies the copy, and writes a readable result file back into the OLD
# bucket at _migration-check/result.txt — fetchable via the site's existing public
# /s3/ proxy (no log access needed to check the outcome).
#
# Remotes are configured entirely via RCLONE_CONFIG_* environment variables rather
# than `rclone config create`, which writes a config file and can hang or fail
# silently in a minimal container (no interactive terminal, uncertain $HOME
# writability) — env vars avoid touching disk for config at all.
#
# Expects: OLD_S3_ENDPOINT, NEW_S3_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD,
# S3_BUCKET (all passed in as env vars by the compose service).
set -u

BUCKET="${S3_BUCKET:-shacky-media}"
RESULT=/tmp/result.txt

export RCLONE_CONFIG_OLD_TYPE=s3
export RCLONE_CONFIG_OLD_PROVIDER=Minio
export RCLONE_CONFIG_OLD_ACCESS_KEY_ID="$MINIO_ROOT_USER"
export RCLONE_CONFIG_OLD_SECRET_ACCESS_KEY="$MINIO_ROOT_PASSWORD"
export RCLONE_CONFIG_OLD_ENDPOINT="$OLD_S3_ENDPOINT"
export RCLONE_CONFIG_OLD_REGION=us-east-1

export RCLONE_CONFIG_NEW_TYPE=s3
export RCLONE_CONFIG_NEW_PROVIDER=Other
export RCLONE_CONFIG_NEW_ACCESS_KEY_ID="$MINIO_ROOT_USER"
export RCLONE_CONFIG_NEW_SECRET_ACCESS_KEY="$MINIO_ROOT_PASSWORD"
export RCLONE_CONFIG_NEW_ENDPOINT="$NEW_S3_ENDPOINT"
export RCLONE_CONFIG_NEW_REGION=us-east-1

# Checkpoint immediately, before the (potentially slow) sync — lets us tell "still
# copying" apart from "never started" without any container log access.
echo "Migration started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$RESULT"
echo "--- source (old) ---" >> "$RESULT"
rclone size old:"$BUCKET" >> "$RESULT" 2>&1 || echo "(could not size old bucket)" >> "$RESULT"
rclone copyto "$RESULT" old:"$BUCKET/_migration-check/result.txt" || true

echo "--- syncing old -> new ---" >> "$RESULT"
if rclone sync old:"$BUCKET" new:"$BUCKET" -v >> "$RESULT" 2>&1; then
  echo "SYNC_OK" >> "$RESULT"
else
  echo "SYNC_FAILED" >> "$RESULT"
fi
rclone copyto "$RESULT" old:"$BUCKET/_migration-check/result.txt" || true

echo "--- destination (new) ---" >> "$RESULT"
rclone size new:"$BUCKET" >> "$RESULT" 2>&1 || echo "(could not size new bucket)" >> "$RESULT"

echo "--- check (old vs new) ---" >> "$RESULT"
if rclone check old:"$BUCKET" new:"$BUCKET" >> "$RESULT" 2>&1; then
  echo "CHECK_PASSED" >> "$RESULT"
  STATUS=0
else
  echo "CHECK_FAILED" >> "$RESULT"
  STATUS=1
fi

echo "Migration finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$RESULT"
cat "$RESULT"

rclone copyto "$RESULT" old:"$BUCKET/_migration-check/result.txt" || true

exit "$STATUS"
