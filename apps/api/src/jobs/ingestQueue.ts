import { Queue } from 'bullmq';
import { env } from '../utils/env.js';
import type { PostForAI, IngestAiOptions } from '../services/docxIngestion.js';

export interface IngestEnhancementJobData {
  issueId: string;
  posts: PostForAI[];
  aiOptions: IngestAiOptions;
  uploadedById: string;
}

function redisConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    // Required by BullMQ — retries block the event loop otherwise
    maxRetriesPerRequest: null as any,
  };
}

export const ingestQueue = new Queue<IngestEnhancementJobData>('ingest-enhancements', {
  connection: redisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { age: 60 * 60 * 24 }, // keep 24h
    removeOnFail: { age: 60 * 60 * 24 * 7 }, // keep 7d
  },
});
