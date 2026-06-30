import { Module, Global } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  providers: [TenantService, TenantGuard],
  exports: [TenantService, TenantGuard],
})
export class TenantModule {}
