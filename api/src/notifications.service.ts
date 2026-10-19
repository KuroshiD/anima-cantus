import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma, NotificationChannel } from "@prisma/client";
import { Queue, Job } from "bullmq";
import nodemailer from "nodemailer";
import { PrismaService } from "./prisma.service";

export interface NotificationJob {
  type: string;
  entityType: string;
  entityId: string;
  reference: string;
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class EmailNotifier {
  async send(message: Pick<NotificationJob, "to" | "subject" | "text">): Promise<void> {
    const user = process.env.SMTP_USER;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "127.0.0.1",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      auth: user ? { user, pass: process.env.SMTP_PASS ?? "" } : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "Anima Cantus <no-reply@animacantus.local>",
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

@Injectable()
export class WhatsAppNotifier {
  send(): Promise<void> {
    return Promise.reject(
      new Error("O envio automático por WhatsApp não faz parte desta versão. O canal automático é o e-mail; o WhatsApp fica no link wa.me."),
    );
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailNotifier,
    @InjectQueue("notifications") private readonly notifications: Queue,
    @InjectQueue("deadlines") private readonly deadlines: Queue,
    @InjectQueue("post-event") private readonly postEvent: Queue,
  ) {}

  jobId(payload: NotificationJob): string {
    return `${payload.type}:${payload.entityId}:${payload.reference}`.replace(/:/g, "-");
  }

  async alreadySent(payload: NotificationJob): Promise<boolean> {
    const found = await this.prisma.notificationLog.findFirst({
      where: {
        type: payload.type,
        entityType: payload.entityType,
        entityId: payload.entityId,
        channel: "EMAIL",
        reference: payload.reference,
        status: "ENVIADO",
      },
    });
    return Boolean(found);
  }

  async enqueue(queue: "notifications" | "deadlines" | "post-event", name: string, payload: NotificationJob): Promise<void> {
    if (!payload.to || (await this.alreadySent(payload))) return;
    const target = queue === "deadlines" ? this.deadlines : queue === "post-event" ? this.postEvent : this.notifications;
    await target.add(name, payload, { jobId: this.jobId(payload) });
  }

  async deliver(payload: NotificationJob, job?: Job): Promise<void> {
    if (await this.alreadySent(payload)) return;
    try {
      await this.email.send(payload);
      try {
        await this.prisma.notificationLog.create({
          data: {
            type: payload.type,
            entityType: payload.entityType,
            entityId: payload.entityId,
            channel: NotificationChannel.EMAIL,
            reference: payload.reference,
            status: "ENVIADO",
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
      if (payload.type === "ANNIVERSARY") await this.completeAnniversary(payload.entityId);
    } catch (error) {
      const attempts = job?.opts.attempts ?? 1;
      const used = (job?.attemptsMade ?? 0) + 1;
      if (used >= attempts) {
        await this.prisma.notificationLog.create({
          data: {
            type: payload.type,
            entityType: payload.entityType,
            entityId: payload.entityId,
            channel: NotificationChannel.EMAIL,
            reference: payload.reference,
            status: "FALHOU",
            detail: error instanceof Error ? error.message : "falha",
          },
        });
      }
      this.logger.error(`Falha ao enviar ${payload.type} para ${payload.to}`);
      throw error;
    }
  }

  private async completeAnniversary(coupleId: string): Promise<void> {
    const journey = await this.prisma.journey.findUnique({
      where: { coupleId },
      include: { steps: true },
    });
    const step = journey?.steps.find((item) => item.step === "POS_EVENTO");
    if (!step) return;
    await this.prisma.journeyStep.updateMany({
      where: { id: step.id, status: "EM_ANDAMENTO" },
      data: { status: "CONCLUIDA" },
    });
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
