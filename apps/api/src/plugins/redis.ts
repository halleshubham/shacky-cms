import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createClient } from 'redis';
import { env } from '../utils/env.js';

export type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient;

export function getRedis(): RedisClient {
  if (!redisClient) throw new Error('Redis not initialised');
  return redisClient;
}

const redisPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const client = createClient({ url: env.REDIS_URL });
  await client.connect();
  redisClient = client as any;
  fastify.decorate('redis', client);
  fastify.addHook('onClose', async () => {
    await client.disconnect();
  });
});

export default redisPlugin;

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClient;
  }
}
