import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { DocumentService } from './document.service';

interface DocumentSocket extends Socket {
  user?: { sub: string; email?: string };
  tenantId?: string;
}

@WebSocketGateway({
  namespace: 'documents',
  cors: { origin: true, credentials: true },
})
export class DocumentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(DocumentGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly documentService: DocumentService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: DocumentSocket): Promise<void> {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    const tenantId = client.handshake.auth?.tenantId as string | undefined;

    if (!token || !tenantId) {
      client.emit('document_error', { message: 'Authentication and tenant are required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      client.user = { sub: payload.sub, email: payload.email };
      client.tenantId = tenantId;
      this.logger.log(`Document socket connected: ${client.id} user=${payload.sub}`);
    } catch {
      client.emit('document_error', { message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: DocumentSocket): Promise<void> {
    this.logger.log(`Document socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_document')
  async handleJoinDocument(
    @ConnectedSocket() client: DocumentSocket,
    @MessageBody() payload: { docId: string },
  ): Promise<void> {
    if (!client.user?.sub || !client.tenantId || !payload?.docId) {
      client.emit('document_error', { message: 'docId is required' });
      return;
    }

    try {
      const doc = await this.documentService.getContent(
        client.user.sub,
        client.tenantId,
        payload.docId,
      );
      await client.join(this.room(payload.docId));
      client.emit('document_state', doc);
      this.server.to(this.room(payload.docId)).emit('document_presence', {
        docId: payload.docId,
        userId: client.user.sub,
        event: 'joined',
      });
    } catch (error) {
      client.emit('document_error', { message: (error as Error).message || 'Join failed' });
    }
  }

  @SubscribeMessage('document_change')
  async handleDocumentChange(
    @ConnectedSocket() client: DocumentSocket,
    @MessageBody() payload: { docId: string; content: string; version?: number },
  ): Promise<void> {
    if (!client.user?.sub || !client.tenantId || !payload?.docId) {
      return;
    }

    this.server.to(this.room(payload.docId)).except(client.id).emit('document_changed', {
      docId: payload.docId,
      content: payload.content ?? '',
      version: payload.version,
      userId: client.user.sub,
      updatedAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('document_save')
  async handleDocumentSave(
    @ConnectedSocket() client: DocumentSocket,
    @MessageBody() payload: { docId: string; content: string },
  ): Promise<void> {
    if (!client.user?.sub || !client.tenantId || !payload?.docId) {
      client.emit('document_save_failed', { message: 'docId is required' });
      return;
    }

    try {
      await this.documentService.assertCanEditContent(
        payload.docId,
        client.user.sub,
        client.tenantId,
      );
      const saved = await this.documentService.saveContent(
        payload.docId,
        client.user.sub,
        client.tenantId,
        payload.content ?? '',
      );
      this.server.to(this.room(payload.docId)).emit('document_saved', {
        docId: payload.docId,
        content: saved.content ?? '',
        userId: client.user.sub,
        updatedAt: saved.updatedAt,
      });
    } catch (error) {
      client.emit('document_save_failed', {
        docId: payload.docId,
        message: (error as Error).message || 'Save failed',
      });
    }
  }

  private room(docId: string): string {
    return `document:${docId}`;
  }
}
