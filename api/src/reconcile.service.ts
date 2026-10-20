import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { anniversaryIso, asDate, classifyRepertoireDeadline, formatDateBR, isoDate, repertoireWindow, todayIso } from "@anima/shared";
import { PrismaService } from "./prisma.service";
import { NotificationsService, type NotificationJob } from "./notifications.service";

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @InjectQueue("notifications") private readonly notificationsQueue?: Queue,
    @InjectQueue("deadlines") private readonly deadlines?: Queue,
    @InjectQueue("post-event") private readonly postEvent?: Queue,
    @InjectQueue("contracts") private readonly contracts?: Queue,
    @InjectQueue("uploads") private readonly uploads?: Queue,
  ) {}

  async run(): Promise<{ reminders: number; anniversaries: number }> {
    const [couples, moments, config] = await Promise.all([
      this.prisma.couple.findMany({
        include: { journey: { include: { steps: true } }, selections: true, user: true },
      }),
      this.prisma.ceremonyMoment.count(),
      this.prisma.alertConfig.findUnique({ where: { id: "default" } }),
    ]);
    const lead = config?.reminderLeadDays ?? 7;
    const today = todayIso();
    let reminders = 0;
    let anniversaries = 0;

    for (const couple of couples) {
      if (!couple.journey) continue;
      const wedding = isoDate(couple.weddingDate);
      const window = repertoireWindow(wedding);
      const anniversary = anniversaryIso(wedding);
      const storedStart = couple.journey.repertoireWindowStart ? isoDate(couple.journey.repertoireWindowStart) : null;
      const storedEnd = couple.journey.repertoireWindowEnd ? isoDate(couple.journey.repertoireWindowEnd) : null;
      const storedAnniversary = couple.journey.anniversarySendOn ? isoDate(couple.journey.anniversarySendOn) : null;
      if (storedStart !== window.start || storedEnd !== window.end || storedAnniversary !== anniversary) {
        await this.prisma.journey.update({
          where: { id: couple.journey.id },
          data: {
            repertoireWindowStart: asDate(window.start),
            repertoireWindowEnd: asDate(window.end),
            anniversarySendOn: asDate(anniversary),
          },
        });
      }

      const repertoire = couple.journey.steps.find((step) => step.step === "REPERTORIO");
      const chosen = couple.selections.filter((selection) => selection.songTitle.trim()).length;
      const email = couple.user?.email;
      const deadline = classifyRepertoireDeadline({
        status: repertoire?.status ?? "",
        filledCount: chosen,
        momentCount: moments,
        windowEnd: window.end,
        today,
        leadDays: lead,
      });
      if (email && deadline !== "none") {
        const overdue = deadline === "overdue";
        reminders += 1;
        await this.notifications.enqueue("deadlines", "remind", {
          type: overdue ? "REPERTOIRE_OVERDUE" : "REPERTOIRE_REMINDER",
          entityType: "couple",
          entityId: couple.id,
          reference: `${overdue ? "overdue" : "reminder"}:${window.end}`,
          to: email,
          subject: overdue ? "Repertório ainda pendente — Anima Cantus" : "Lembrete do repertório — Anima Cantus",
          text: `A janela recomendada vai de ${formatDateBR(window.start)} a ${formatDateBR(window.end)}. Faltam ${moments - chosen} música(s) no repertório de ${couple.partnerOne} & ${couple.partnerTwo}.`,
        });
      }

      const after = couple.journey.steps.find((step) => step.step === "POS_EVENTO");
      if (email && after && after.status !== "PENDENTE" && today >= anniversary) {
        anniversaries += 1;
        await this.notifications.enqueue("post-event", "anniversary", {
          type: "ANNIVERSARY",
          entityType: "couple",
          entityId: couple.id,
          reference: `anniversary:${anniversary}`,
          to: email,
          subject: "Um ano do casamento de vocês — Anima Cantus",
          text: `Olá, ${couple.partnerOne} e ${couple.partnerTwo}. Faz um ano da cerimônia de ${formatDateBR(wedding)}. Foi uma alegria tocar essa história com vocês.`,
        });
      }
    }

    await this.prisma.systemHeartbeat.upsert({
      where: { id: "reconcile" },
      create: { id: "reconcile", ranAt: new Date() },
      update: { ranAt: new Date() },
    });
    this.logger.log(`Reconcile: ${reminders} lembretes e ${anniversaries} aniversários avaliados.`);
    return { reminders, anniversaries };
  }

  async opsCheck(): Promise<void> {
    const queues = [this.notificationsQueue, this.deadlines, this.postEvent, this.contracts, this.uploads].filter(
      (queue): queue is Queue => Boolean(queue),
    );
    const failed = (await Promise.all(queues.map((queue) => queue.getFailedCount()))).reduce((sum, count) => sum + count, 0);
    const threshold = Number(process.env.FAILED_JOBS_ALERT_THRESHOLD ?? 5);
    const today = todayIso();
    const team = process.env.TEAM_EMAIL;
    if (!team) return;
    if (failed >= threshold) {
      await this.notifications.enqueue("notifications", "send", this.opsPayload(`failed:${today}`, `${failed} jobs permanecem como falhos nas filas.`));
    }
    const beat = await this.prisma.systemHeartbeat.findUnique({ where: { id: "reconcile" } });
    const ran = beat ? todayIso("America/Sao_Paulo", beat.ranAt) : null;
    if (ran !== today) {
      await this.notifications.enqueue("notifications", "send", this.opsPayload(`missed:${today}`, "O reconcile diário não registrou execução hoje."));
    }
  }

  private opsPayload(reference: string, text: string): NotificationJob {
    return {
      type: "OPS_ALERT",
      entityType: "system",
      entityId: "ops",
      reference,
      to: process.env.TEAM_EMAIL ?? "",
      subject: "Alerta operacional — Anima Cantus",
      text,
    };
  }
}
