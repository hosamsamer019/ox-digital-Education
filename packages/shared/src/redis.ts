import { createClient } from 'redis';
import { logger } from './logger.js';

let redisClient: ReturnType<typeof createClient> | null = null;

export const initRedis = async () => {
  if (redisClient) {
    return redisClient;
  }

  if (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL) {
    if (process.env.NODE_ENV === 'production' && process.env.DISABLE_REDIS !== 'true') {
      const msg = 'REDIS_URL not configured. Redis is strictly required in production for secure session and token handling.';
      logger.error(msg);
      throw new Error(msg);
    }
    logger.warn('Redis is disabled (DISABLE_REDIS=true or REDIS_URL unset). Falling back to in-memory store.');
    return null;
  }

  let client: ReturnType<typeof createClient> | null = null;
  try {
    client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (process.env.NODE_ENV !== 'production') {
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    }) as ReturnType<typeof createClient>;

    client.on('error', (err) => {
      if (process.env.NODE_ENV === 'production') {
        logger.error('Redis Client Error', err);
      } else {
        logger.warn('Redis client error in development (ignoring for in-memory fallback): ' + (err?.message || 'ECONNREFUSED'));
      }
    });
    client.on('connect', () => logger.info('Redis connected successfully.'));

    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (error) {
    redisClient = null;
    if (client && (client as any).isOpen) {
      try {
        await client.disconnect();
      } catch {
        // Disconnect cleanly
      }
    }
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: Failed to initialize Redis in production.', error);
      throw error;
    }
    logger.warn('Redis is not available in development. Falling back to in-memory store.');
    return null;
  }
};

export const getRedisClient = () => redisClient;

export const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Disconnect cleanly
    }
    redisClient = null;
  }
};

/**
 * JTI Blocklist Strategy:
 * When a user logs out, we take their refresh token's JTI and add it to Redis with an expiration 
 * matching the token's remaining TTL.
 */
const memoryResetStore = new Map<string, { email: string; expiresAt: number }>();
const memoryBlocklist = new Map<string, number>();

export const blocklistToken = async (jti: string, expiresInSecs: number) => {
  if (redisClient) {
    try {
      await redisClient.setEx(`blocklist:jti:${jti}`, expiresInSecs, 'true');
      return;
    } catch (err) {
      logger.error('Redis blocklist error:', err);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to blocklist token in Redis');
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis is required in production for token revocation');
  }
  memoryBlocklist.set(jti, Date.now() + expiresInSecs * 1000);
};

export const isTokenBlocklisted = async (jti: string): Promise<boolean> => {
  if (redisClient) {
    try {
      const exists = await redisClient.get(`blocklist:jti:${jti}`);
      return exists === 'true';
    } catch (err) {
      logger.error('Redis blocklist check error:', err);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to verify token revocation in Redis');
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis is required in production for token revocation check');
  }
  const expiry = memoryBlocklist.get(jti);
  if (expiry && expiry > Date.now()) {
    return true;
  }
  return false;
};

export const setPasswordResetToken = async (tokenHash: string, email: string, ttlSeconds: number = 3600) => {
  if (redisClient) {
    try {
      await redisClient.setEx(`reset:${tokenHash}`, ttlSeconds, email);
      return;
    } catch (err) {
      logger.error('Redis setPasswordResetToken error:', err);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to store password reset token in Redis');
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis is required in production for password reset token storage');
  }
  memoryResetStore.set(tokenHash, { email, expiresAt: Date.now() + ttlSeconds * 1000 });
};

export const getPasswordResetEmail = async (tokenHash: string): Promise<string | null> => {
  if (redisClient) {
    try {
      const email = await redisClient.get(`reset:${tokenHash}`);
      if (email) return email;
      return null;
    } catch (err) {
      logger.error('Redis getPasswordResetEmail error:', err);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to retrieve password reset token from Redis');
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis is required in production for password reset token retrieval');
  }
  const mem = memoryResetStore.get(tokenHash);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.email;
  }
  return null;
};

export const deletePasswordResetToken = async (tokenHash: string) => {
  if (redisClient) {
    try {
      await redisClient.del(`reset:${tokenHash}`);
      return;
    } catch (err) {
      logger.error('Redis deletePasswordResetToken error:', err);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to delete password reset token in Redis');
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis is required in production for password reset token deletion');
  }
  memoryResetStore.delete(tokenHash);
};

