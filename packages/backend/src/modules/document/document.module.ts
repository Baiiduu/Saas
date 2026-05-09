import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentGateway } from './document.gateway';
import { DocumentService } from './document.service';
import { DocumentSearchService } from './document-search.service';
import { StorageModule } from '../storage/storage.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StorageModule, RbacModule, AuditModule],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentSearchService, DocumentGateway],
  exports: [DocumentService, DocumentSearchService],
})
export class DocumentModule {}
