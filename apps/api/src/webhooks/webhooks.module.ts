import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Module({
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    {
      provide: 'MESSAGE_QUEUE',
      useFactory: () =>
        new Queue('process_message', {
          connection: new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
          }),
        }),
    },
  ],
})
export class WebhooksModule {}
