import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessageService, SendMessagePayload } from './message.service';

// Extend Socket to include user property from auth
interface AuthenticatedSocket extends Socket {
  user?: {
    sub: string;
    email: string;
  };
}

@WebSocketGateway({
  namespace: 'messages',
  cors: { origin: true, credentials: true },
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessageGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly messageService: MessageService) {}

  /**
   * Handle new socket connections.
   * Extract user info from auth handshake.
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const auth = client.handshake.auth;
    if (auth?.userId) {
      client.user = { sub: auth.userId, email: auth.email || '' };
      this.logger.log(`Socket connected: ${client.id} (user: ${auth.userId})`);
    } else {
      this.logger.log(`Socket connected (unauthenticated): ${client.id}`);
    }
  }

  /**
   * Handle socket disconnections.
   */
  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  // ── Events ─────────────────────────────────────────────────

  /**
   * Join a team room so the client can receive team messages.
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    client: AuthenticatedSocket,
    payload: { teamId: string },
  ): Promise<void> {
    if (!payload?.teamId) {
      client.emit('error', { message: 'teamId is required' });
      return;
    }

    await client.join(`team:${payload.teamId}`);
    this.logger.log(`Socket ${client.id} joined team:${payload.teamId}`);
    client.emit('joined', { teamId: payload.teamId });
  }

  /**
   * Send a message to a team room.
   * Persists the message and broadcasts to the team room.
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    client: AuthenticatedSocket,
    payload: {
      teamId: string;
      content: string;
      type?: string;
      references?: Array<{ type: 'task' | 'doc'; resourceId: string; label?: string }>;
    },
  ): Promise<void> {
    if (!payload?.teamId || !payload?.content) {
      client.emit('error', { message: 'teamId and content are required' });
      return;
    }

    if (!client.user) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    try {
      const message = await this.messageService.sendMessage(client.user.sub, {
        teamId: payload.teamId,
        content: payload.content,
        type: (payload.type as any) || 'TEXT',
        references: payload.references ?? [],
      } as SendMessagePayload);

      // Broadcast to the team room (excluding sender)
      this.server
        .to(`team:${payload.teamId}`)
        .except(client.id)
        .emit('new_message', message);

      // Also acknowledge to sender
      client.emit('message_sent', message);
    } catch (error: any) {
      this.logger.error(`Failed to send message: ${error.message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }
}
