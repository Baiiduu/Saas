import { Module } from '@nestjs/common';
import { TenantController, InvitationController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantProvisionService } from './tenant.provision.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [TenantController, InvitationController],
  providers: [TenantService, TenantProvisionService],
  exports: [TenantService, TenantProvisionService],
})
export class TenantModule {}
