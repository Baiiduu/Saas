import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';

// ── Feature modules ─────────────────────────────────────────
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { TeamModule } from './modules/team/team.module';
import { TaskModule } from './modules/task/task.module';
import { BoardModule } from './modules/board/board.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { CommentModule } from './modules/comment/comment.module';
import { DocumentModule } from './modules/document/document.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { StorageModule } from './modules/storage/storage.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ResourceModule } from './modules/resource/resource.module';
import { MilestoneModule } from './modules/milestone/milestone.module';
import { MessageModule } from './modules/message/message.module';
import { GraphModule } from './modules/graph/graph.module';
import { AuditModule } from './modules/audit/audit.module';
import { LlmModule } from './modules/llm/llm.module';

// ── Global filters, guards, interceptors, pipes ──────────
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

// ── Middleware ─────────────────────────────────────────────
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { SecurityMiddleware } from './common/middleware/security.middleware';

// ── Services ──────────────────────────────────────────────
import { PrismaTenantService } from './prisma/prisma-tenant.service';

// ── Config files ───────────────────────────────────────────
import databaseConfig from './common/config/database.config';
import jwtConfig from './common/config/jwt.config';
import redisConfig from './common/config/redis.config';
import storageConfig from './common/config/storage.config';
import llmConfig from './modules/llm/config/llm.config';

@Module({
  imports: [
    // Global configuration from config files + .env
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig, storageConfig, llmConfig],
    }),

    // Global rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,            // 1 minute window
      limit: 100,            // max 100 requests per minute
    }]),

    PrismaModule,
    AuthModule,
    UserModule,
    TenantModule,
    TeamModule,
    TaskModule,
    BoardModule,
    ApprovalModule,
    CommentModule,
    DocumentModule,
    NotificationModule,
    DashboardModule,
    StorageModule,
    RbacModule,
    ResourceModule,
    MilestoneModule,
    MessageModule,
    GraphModule,
    AuditModule,
    LlmModule,

    // Register JwtModule globally so JwtAuthGuard can inject JwtService
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRATION || '15m' },
    }),
  ],
  providers: [
    // ── Tenant data isolation ─────────────────────────────
    PrismaTenantService,

    // ── Guards (order matters: JWT → Tenant → RBAC → Throttler) ──
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // ── Global exception filter ──────────────────────────
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // ── Global interceptors ──────────────────────────────
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },

    // ── Global pipes ─────────────────────────────────────
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply SecurityMiddleware first (headers, CSRF, XSS prevention)
    consumer.apply(SecurityMiddleware).forRoutes('*');

    // Apply TenantMiddleware to all routes so X-Tenant-Id
    // is always extracted before guards/interceptors run.
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
