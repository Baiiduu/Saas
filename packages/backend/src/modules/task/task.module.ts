import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskTemplateService } from './task-template.service';

@Module({
  controllers: [TaskController],
  providers: [TaskService, TaskTemplateService],
  exports: [TaskService, TaskTemplateService],
})
export class TaskModule {}
