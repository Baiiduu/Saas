import { Module, OnModuleInit } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { LlmSessionService } from './llm.session.service';
import { LlmSkillService } from './llm.skill.service';
import { LlmAuditService } from './llm.audit.service';
import { LlmAuthorizationService } from './llm.authorization.service';
import { LlmIntentRouterService } from './llm.intent-router.service';
import { LlmResponseComposerService } from './llm.response-composer.service';
import { MCPContextBuilder } from './mcp/mcp.context-builder';
import { MCPToolRegistry } from './mcp/mcp.tool-registry';
import { MCPToolBootstrapService } from './mcp/mcp.tool-bootstrap.service';
import { SkillRegistry } from './skills/skill.registry';
import { SummarySkill, registerSummarySkill } from './skills/summary.skill';
import { WeeklyReportSkill, registerWeeklyReportSkill } from './skills/weekly-report.skill';
import { TaskSuggestionSkill, registerTaskSuggestionSkill } from './skills/task-suggestion.skill';
import { DocDraftSkill, registerDocDraftSkill } from './skills/doc-draft.skill';
import { ApprovalAssistSkill, registerApprovalAssistSkill } from './skills/approval-assist.skill';
import { PrismaModule } from '../../prisma/prisma.module';
import { TaskModule } from '../task/task.module';
import { DocumentModule } from '../document/document.module';
import { ApprovalModule } from '../approval/approval.module';
import { TeamModule } from '../team/team.module';
import { MilestoneModule } from '../milestone/milestone.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    PrismaModule,
    TaskModule,
    DocumentModule,
    ApprovalModule,
    TeamModule,
    MilestoneModule,
    RbacModule,
  ],
  controllers: [LlmController],
  providers: [
    LlmService,
    LlmSessionService,
    LlmSkillService,
    LlmAuditService,
    LlmAuthorizationService,
    LlmIntentRouterService,
    LlmResponseComposerService,
    MCPContextBuilder,
    MCPToolRegistry,
    MCPToolBootstrapService,
    SkillRegistry,
    SummarySkill,
    WeeklyReportSkill,
    TaskSuggestionSkill,
    DocDraftSkill,
    ApprovalAssistSkill,
  ],
  exports: [
    LlmService,
    LlmSessionService,
    LlmSkillService,
    MCPToolRegistry,
    SkillRegistry,
  ],
})
export class LlmModule implements OnModuleInit {
  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly summarySkill: SummarySkill,
    private readonly weeklyReportSkill: WeeklyReportSkill,
    private readonly taskSuggestionSkill: TaskSuggestionSkill,
    private readonly docDraftSkill: DocDraftSkill,
    private readonly approvalAssistSkill: ApprovalAssistSkill,
  ) {}

  onModuleInit(): void {
    registerSummarySkill(this.skillRegistry, this.summarySkill);
    registerWeeklyReportSkill(this.skillRegistry, this.weeklyReportSkill);
    registerTaskSuggestionSkill(this.skillRegistry, this.taskSuggestionSkill);
    registerDocDraftSkill(this.skillRegistry, this.docDraftSkill);
    registerApprovalAssistSkill(this.skillRegistry, this.approvalAssistSkill);
  }
}
