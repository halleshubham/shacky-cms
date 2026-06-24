import { Worker } from 'bullmq';
import { env } from '../utils/env.js';
import { runIngestEnhancements } from '../services/docxIngestion.js';
import type { IngestEnhancementJobData } from '../jobs/ingestQueue.js';

function redisConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as any,
  };
}

export function startIngestWorker() {
  const worker = new Worker<IngestEnhancementJobData>(
    'ingest-enhancements',
    async (job) => {
      const { posts, aiOptions, uploadedById } = job.data;
      const warnings = await runIngestEnhancements(posts, aiOptions, uploadedById);
      if (warnings.length > 0) {
        console.warn(`[ingest-worker] job ${job.id} completed with ${warnings.length} warning(s):`, warnings);
      }
      return { warnings };
    },
    {
      connection: redisConnection(),
      concurrency: 1, // one enhancement job at a time (stock searches already have their own limiter)
    },
  );

  worker.on('completed', (job) => {
    console.log(`[ingest-worker] job ${job.id} done — issue enhancements complete`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[ingest-worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
