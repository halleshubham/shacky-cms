import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/env.js', () => ({
  env: { S3_ENDPOINT: 'http://s3.test', S3_REGION: 'us-east-1', S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 's', S3_BUCKET: 'b', S3_PUBLIC_URL: 'http://s3.test/b' },
}));

import { s3, ensureBucket } from '../src/utils/s3';

const send = vi.spyOn(s3, 'send');
beforeEach(() => { send.mockReset(); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); });

const notFound = () => Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
const names = () => send.mock.calls.map((c) => (c[0] as any).constructor.name);

describe('ensureBucket', () => {
  it('does nothing when the bucket exists', async () => {
    send.mockResolvedValueOnce({} as any);
    expect(await ensureBucket()).toBe(true);
    expect(names()).toEqual(['HeadBucketCommand']);
  });

  it('creates the bucket when it is missing', async () => {
    send.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({} as any);
    expect(await ensureBucket()).toBe(true);
    expect(names()).toEqual(['HeadBucketCommand', 'CreateBucketCommand']);
  });

  it('does not try to create on non-404 errors (e.g. storage unreachable) and never throws', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('ECONNREFUSED'), { name: 'Error' }));
    expect(await ensureBucket()).toBe(false);
    expect(names()).toEqual(['HeadBucketCommand']);
  });

  it('returns false instead of throwing when creation fails', async () => {
    send.mockRejectedValueOnce(notFound()).mockRejectedValueOnce(new Error('AccessDenied'));
    expect(await ensureBucket()).toBe(false);
  });
});
