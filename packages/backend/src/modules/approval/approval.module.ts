import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalEngineService } from './approval-engine.service';
import { ApprovalTemplateService } from './approval-template.service';
import { ApprovalTimeoutService } from './approval-timeout.service';

@Module({
  controllers: [ApprovalController],
  providers: [
    ApprovalService,
    ApprovalEngineService,
    ApprovalTemplateService,
    ApprovalTimeoutService,
  ],
  exports: [
    ApprovalService,
    ApprovalEngineService,
    ApprovalTemplateService,
    ApprovalTimeoutService,
  ],
})
export class ApprovalModule {}
