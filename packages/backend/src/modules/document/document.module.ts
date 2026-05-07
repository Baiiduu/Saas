import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentSearchService } from './document-search.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentSearchService],
  exports: [DocumentService, DocumentSearchService],
})
export class DocumentModule {}
