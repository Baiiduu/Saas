import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';

/**
 * In-memory task template store for V2 prototype.
 *
 * Task templates allow users to create tasks from pre-defined templates,
 * saving time on repetitive task creation.
 *
 * ⚠ In production, these would be persisted in a database table.
 */
interface TaskTemplateRecord {
  id: string;
  name: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultPriority?: string;
  defaultTags?: string[];
  teamId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TaskTemplateService {
  private readonly logger = new Logger(TaskTemplateService.name);

  /** In-memory template store. */
  private readonly templates = new Map<string, TaskTemplateRecord>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new task template.
   */
  async create(userId: string, dto: CreateTaskTemplateDto): Promise<TaskTemplateRecord> {
    const id = this.generateId();
    const now = new Date();
    const template: TaskTemplateRecord = {
      id,
      name: dto.name,
      defaultTitle: dto.defaultTitle,
      defaultDescription: dto.defaultDescription,
      defaultPriority: dto.defaultPriority,
      defaultTags: dto.defaultTags,
      teamId: dto.teamId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(id, template);
    this.logger.log(`Task template "${template.name}" (${id}) created by user ${userId}`);
    return template;
  }

  /**
   * List templates for a team.
   */
  async findByTeam(teamId: string): Promise<TaskTemplateRecord[]> {
    return Array.from(this.templates.values())
      .filter((t) => t.teamId === teamId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a single template by ID.
   */
  async findById(id: string): Promise<TaskTemplateRecord> {
    const template = this.templates.get(id);
    if (!template) {
      throw new NotFoundException('Task template not found');
    }
    return template;
  }

  /**
   * Delete a template.
   */
  async delete(id: string): Promise<void> {
    if (!this.templates.has(id)) {
      throw new NotFoundException('Task template not found');
    }
    this.templates.delete(id);
    this.logger.log(`Task template ${id} deleted`);
  }

  private generateId(): string {
    return `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}
