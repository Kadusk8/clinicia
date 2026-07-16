import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PatientsModule } from './patients/patients.module';
import { ServicesModule } from './services/services.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ConversationsModule } from './conversations/conversations.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { ClinicsModule } from './clinics/clinics.module';
import { ReportsModule } from './reports/reports.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 1000,   // 1 second window
      limit: 10,   // max 10 requests per second per IP
    }]),
    TenantModule,
    AuthModule,
    AdminModule,
    PatientsModule,
    ServicesModule,
    ProfessionalsModule,
    AppointmentsModule,
    ConversationsModule,
    WebhooksModule,
    PipelineModule,
    FollowUpsModule,
    ClinicsModule,
    ReportsModule,
    KnowledgeBaseModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
