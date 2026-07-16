import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { db } from '@crm-clinicas/db';
import { sql } from 'drizzle-orm';
import IORedis from 'ioredis';

@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'crm-clinicas-api',
      db: 'unknown',
      redis: 'unknown',
    };

    // Check DB
    try {
      await db.execute(sql`SELECT 1`);
      health.db = 'up';
    } catch (e) {
      health.db = 'down';
      health.status = 'error';
    }

    // Check Redis
    try {
      const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        commandTimeout: 1000,
      });
      await redis.ping();
      health.redis = 'up';
      redis.disconnect();
    } catch (e) {
      health.redis = 'down';
      health.status = 'error';
    }

    return health;
  }
}
