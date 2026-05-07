import { Module, OnModuleInit } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { MCPContextBuilder } from './mcp/mcp.context-builder';
import { MCPToolRegistry } from './mcp/mcp.tool-registry';
import { SkillRegistry } from './skills/skill.registry';
import { SummarySkill, registerSummarySkill } from './skills/summary.skill';
import { WeeklyReportSkill, registerWeeklyReportSkill } from './skills/weekly-report.skill';
import { TaskSuggestionSkill, registerTaskSuggestionSkill } from './skills/task-suggestion.skill';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LlmController],
  providers: [
    LlmService,
    MCPContextBuilder,
    MCPToolRegistry,
    SkillRegistry,
    SummarySkill,
    WeeklyReportSkill,
    TaskSuggestionSkill,
  ],
  exports: [LlmService, MCPToolRegistry, SkillRegistry],
})
export class LlmModule implements OnModuleInit {
  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly summarySkill: SummarySkill,
    private readonly weeklyReportSkill: WeeklyReportSkill,
    private readonly taskSuggestionSkill: TaskSuggestionSkill,
  ) {}

  onModuleInit(): void {
    // Register skills in the skill registry
    registerSummarySkill(this.skillRegistry, this.summarySkill);
    registerWeeklyReportSkill(this.skillRegistry, this.weeklyReportSkill);
    registerTaskSuggestionSkill(this.skillRegistry, this.taskSuggestionSkill);
  }
}
