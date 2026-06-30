import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Module({
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    {
      provide: 'EMBEDDING_QUEUE',
      useFactory: () =>
        new Queue('embedding', {
          connection: new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
          }),
        }),
    },
  ],
})
export class KnowledgeBaseModule {}
