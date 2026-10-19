import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";
import type { IncomingMessage } from "http";
import { PrismaService } from "../prisma.service";
import { RedisService } from "../redis.service";
import { StorageService } from "../storage.service";
import { EmailNotifier, NotificationsService, WhatsAppNotifier } from "../notifications.service";
import { ReconcileService } from "../reconcile.service";

const jobDefaults = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: false,
};

function requestId(req: IncomingMessage): string {
  const header = req.headers["x-request-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return value || randomUUID();
}

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        genReqId: requestId,
        customProps: (req) => ({ correlationId: req.id }),
      },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "127.0.0.1",
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue(
      { name: "notifications", defaultJobOptions: jobDefaults },
      { name: "contracts", defaultJobOptions: jobDefaults },
      { name: "uploads", defaultJobOptions: jobDefaults },
      { name: "deadlines", defaultJobOptions: jobDefaults },
      { name: "post-event", defaultJobOptions: jobDefaults },
    ),
  ],
  providers: [PrismaService, RedisService, StorageService, EmailNotifier, WhatsAppNotifier, NotificationsService, ReconcileService],
  exports: [PrismaService, RedisService, StorageService, EmailNotifier, WhatsAppNotifier, NotificationsService, ReconcileService, BullModule],
})
export class InfraModule {}
