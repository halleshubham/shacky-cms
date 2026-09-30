#!/bin/sh
# Copies every object from the old MinIO-backed bucket to the new SeaweedFS-backed
# bucket via a local staging directory (download then upload), verifies the copy,
# and writes a readable result file back into the OLD bucket at
# _migration-check/result.txt — fetchable via the site's existing public /s3/
# proxy (no container log access needed to check the outcome).
#
# Uses aws-cli rather than rclone: rclone hung with zero output for 15+ minutes
# against this exact old bucket for reasons never root-caused, while aws-cli
# (already used successfully elsewhere in this compose for bucket creation)
# reached the same bucket from a fresh container in seconds. `aws s3 sync`
# only talks to one endpoint per invocation, hence the two-step staging approach
# instead of a direct bucket-to-bucket sync.
#
# Expects: OLD_S3_ENDPOINT, NEW_S3_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD,
# S3_BUCKET (all passed in as env vars by the compose service).
set -u

BUCKET="${S3_BUCKET:-shacky-media}"
RESULT=/tmp/result.txt
STAGING=/staging

export AWS_ACCESS_KEY_ID="$MINIO_ROOT_USER"
export AWS_SECRET_ACCESS_KEY="$MINIO_ROOT_PASSWORD"
export AWS_DEFAULT_REGION=us-east-1

publish() { timeout 45 aws --endpoint-url "$OLD_S3_ENDPOINT" s3 cp "$RESULT" "s3://$BUCKET/_migration-check/result.txt" >>"$RESULT" 2>&1 || true; }

mkdir -p "$STAGING"

echo "Migration started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$RESULT"

echo "--- source (old) summary ---" >> "$RESULT"
timeout 60 aws --endpoint-url "$OLD_S3_ENDPOINT" s3 ls "s3://$BUCKET" --recursive --summarize >> "$RESULT" 2>&1 \
  || echo "(could not summarize old bucket)" >> "$RESULT"
publish

echo "--- downloading old -> $STAGING ---" >> "$RESULT"
if timeout 1200 aws --endpoint-url "$OLD_S3_ENDPOINT" s3 sync "s3://$BUCKET" "$STAGING" >> "$RESULT" 2>&1; then
  echo "DOWNLOAD_OK" >> "$RESULT"
else
  echo "DOWNLOAD_FAILED (exit $?)" >> "$RESULT"
fi
publish

echo "--- uploading $STAGING -> new ---" >> "$RESULT"
if timeout 1200 aws --endpoint-url "$NEW_S3_ENDPOINT" s3 sync "$STAGING" "s3://$BUCKET" >> "$RESULT" 2>&1; then
  echo "UPLOAD_OK" >> "$RESULT"
  STATUS=0
else
  echo "UPLOAD_FAILED (exit $?)" >> "$RESULT"
  STATUS=1
fi
publish

echo "--- destination (new) summary ---" >> "$RESULT"
timeout 60 aws --endpoint-url "$NEW_S3_ENDPOINT" s3 ls "s3://$BUCKET" --recursive --summarize >> "$RESULT" 2>&1 \
  || echo "(could not summarize new bucket)" >> "$RESULT"

echo "Migration finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$RESULT"
cat "$RESULT"

publish

exit "$STATUS"
