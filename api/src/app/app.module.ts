import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { BullBoardModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { InfraModule } from "../app/infra.module";
import { AuthModule } from "../modules/auth/auth.module";
import { JourneyModule } from "../modules/journey/journey.module";
import { CatalogModule } from "../modules/catalog/catalog.module";
import { ContractsModule } from "../modules/contracts/contracts.module";
import { RepertoireModule } from "../modules/repertoire/repertoire.module";
import { AlertsModule } from "../modules/alerts/alerts.module";
import { PublicModule } from "../modules/public/public.module";
import { AdminModule } from "../modules/admin/admin.module";
import { CorrelationMiddleware, OriginMiddleware, adminBoardMiddleware } from "../security";

const queues = ["notifications", "contracts", "uploads", "deadlines", "post-event"] as const;

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    InfraModule,
    BullBoardModule.forRoot({
      route: "/queues",
      adapter: ExpressAdapter,
      middleware: adminBoardMiddleware,
    }),
    ...queues.map((name) => BullBoardModule.forFeature({ name, adapter: BullMQAdapter })),
    AuthModule,
    PublicModule,
    JourneyModule,
    CatalogModule,
    ContractsModule,
    RepertoireModule,
    AlertsModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware, OriginMiddleware).forRoutes("{*splat}");
  }
}
