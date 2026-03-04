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

/** Delete cache entries by exact key or glob pattern. Fails silently. */
export async function invalidateCache(...patterns: string[]): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    for (const pattern of patterns) {
      if (pattern.includes("*")) {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } else {
        await client.del(pattern);
      }
    }
  } catch {
    // Ignore — cache invalidation is best-effort
  }
}
