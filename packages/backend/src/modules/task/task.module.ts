import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskTemplateService } from './task-template.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [TaskController],
  providers: [TaskService, TaskTemplateService],
  exports: [TaskService, TaskTemplateService],
})
export class TaskModule {}
