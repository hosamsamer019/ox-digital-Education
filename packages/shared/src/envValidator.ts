import { logger } from './logger';

export function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(`[FATAL] ${errorMsg}`);
    process.exit(1);
  }
}
