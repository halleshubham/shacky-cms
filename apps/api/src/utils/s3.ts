import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
  // AWS SDK v3 defaults to sending/validating flexible-checksum trailers
  // (x-amz-checksum-*) on every request since ~3.729 — many S3-compatible servers
  // (SeaweedFS included) don't support them and reject the request outright. Only
  // compute/validate checksums when an operation actually requires one.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `${env.S3_PUBLIC_URL}/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn },
  );
}

export function keyFromUrl(url: string): string {
  const key = url.replace(`${env.S3_PUBLIC_URL}/`, '');
  // Imported legacy files can have non-ASCII names, stored percent-encoded in the URL.
  try { return decodeURIComponent(key); } catch { return key; }
}

/**
 * Makes sure the media bucket exists. The compose files create it with a one-shot
 * init container, but that job is easy to miss (it can fail silently and the stack
 * still reports healthy), after which every upload fails with a generic 500. Doing it
 * here makes the API self-sufficient. Never throws: a storage hiccup at boot must not
 * stop the API from serving everything that doesn't touch media.
 */
export async function ensureBucket(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return true;
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (status !== 404 && err?.name !== 'NotFound' && err?.name !== 'NoSuchBucket') {
      console.warn(`[s3] Could not check bucket "${env.S3_BUCKET}": ${err?.message ?? err}`);
      return false;
    }
  }
  try {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    console.log(`[s3] Created missing bucket "${env.S3_BUCKET}"`);
    return true;
  } catch (err: any) {
    console.warn(`[s3] Could not create bucket "${env.S3_BUCKET}": ${err?.message ?? err}`);
    return false;
  }
}
