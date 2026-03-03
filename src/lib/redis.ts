import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on("error", (err) => {
      console.error("Redis connection error:", err.message);
    });
  }

  return redis;
}

// Simple cache helper — falls back gracefully if Redis is unavailable
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const client = getRedis();

  if (client) {
    try {
      const hit = await client.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      // Redis down — fall through to fetcher
    }
  }

  const data = await fetcher();

  if (client) {
    try {
      await client.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch {
      // Ignore cache write failures
    }
  }

  return data;
}
