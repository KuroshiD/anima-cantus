import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Job, Queue, UnrecoverableError } from "bullmq";
import { createHash } from "crypto";
import { formatBRL, formatDateBR, isoDate } from "@anima/shared";
import { PrismaService } from "./prisma.service";
import { StorageService } from "./storage.service";
import { NotificationJob, NotificationsService } from "./notifications.service";
import { ReconcileService } from "./reconcile.service";
import { buildContractPdf } from "./pdf";
import { scanBuffer } from "./clam";

interface SnapshotItem {
  name: string;
  priceLabel?: string;
  priceCents: number;
}

@Processor("notifications")
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  process(job: Job<NotificationJob>): Promise<void> {
    return this.notifications.deliver(job.data, job);
  }
}

@Processor("post-event")
export class PostEventProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  process(job: Job<NotificationJob>): Promise<void> {
    return this.notifications.deliver(job.data, job);
  }
}

@Processor("deadlines")
export class DeadlinesProcessor extends WorkerHost {
  constructor(
    private readonly reconcile: ReconcileService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  process(job: Job<NotificationJob>): Promise<unknown> {
    if (job.name === "reconcile") return this.reconcile.run();
    if (job.name === "ops-check") return this.reconcile.opsCheck();
    if (job.name === "remind") return this.notifications.deliver(job.data, job);
    return Promise.resolve();
  }
}

@Processor("contracts")
export class ContractsProcessor extends WorkerHost {
  private readonly logger = new Logger(ContractsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ contractId: string; snapshotId: string }>): Promise<void> {
    const snapshot = await this.prisma.contractSnapshot.findUniqueOrThrow({
      where: { id: job.data.snapshotId },
      include: { contract: { include: { couple: { include: { user: true } } } } },
    });
    const key = `contracts/${snapshot.contractId}/generated/${snapshot.id}.pdf`;
    const existing = await this.prisma.contractFile.findFirst({ where: { objectKey: key } });
    if (!existing) {
      const items = (snapshot.itemsJson as unknown as SnapshotItem[]).map((item) => ({
        name: item.name,
        priceLabel: item.priceLabel ?? formatBRL(item.priceCents),
      }));
      const bytes = await buildContractPdf({
        legalName: snapshot.legalName,
        documentId: snapshot.documentId,
        email: snapshot.email,
        phone: snapshot.phone,
        address: snapshot.address,
        weddingDate: formatDateBR(isoDate(snapshot.weddingDate)),
        weddingTime: snapshot.weddingTime,
        venue: snapshot.venue,
        formation: snapshot.formation,
        paymentTerms: snapshot.paymentTerms,
        totalInWords: snapshot.totalInWords,
        totalLabel: formatBRL(snapshot.totalCents),
        items,
      });
      await this.storage.putPdf(key, bytes);
      await this.prisma.contractFile.create({
        data: {
          contractId: snapshot.contractId,
          snapshotId: snapshot.id,
          kind: "GERADO",
          objectKey: key,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          sizeBytes: bytes.byteLength,
        },
      });
    }
    const email = snapshot.contract.couple.user?.email ?? snapshot.email;
    await this.notifications.enqueue("notifications", "send", {
      type: "CONTRACT_READY",
      entityType: "contract",
      entityId: snapshot.contractId,
      reference: `pdf:${snapshot.id}`,
      to: email,
      subject: "Seu contrato está pronto — Anima Cantus",
      text: "O PDF do contrato já pode ser baixado na área do casal. Assine pelo gov.br e envie o arquivo assinado.",
    });
    this.logger.log(`PDF gerado para o contrato ${snapshot.contractId}`);
  }
}

@Processor("uploads")
export class UploadsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {
    super();
  }

  async process(job: Job<{ contractId: string; snapshotId: string; key: string }>): Promise<void> {
    const { contractId, snapshotId, key } = job.data;
    try {
      const stored = await this.storage.read(key);
      if (stored.size > 10 * 1024 * 1024) throw new UnrecoverableError("O arquivo tem mais de 10 MB.");
      if (stored.body.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new UnrecoverableError("O arquivo não é um PDF válido.");
      }
      const host = process.env.CLAMAV_HOST;
      if (host) {
        const verdict = await scanBuffer(host, Number(process.env.CLAMAV_PORT ?? 3310), stored.body);
        if (verdict === "FOUND") throw new UnrecoverableError("O arquivo foi recusado pela varredura.");
      }
      const sha256 = createHash("sha256").update(stored.body).digest("hex");
      const existing = await this.prisma.contractFile.findFirst({ where: { objectKey: key } });
      if (!existing) {
        await this.prisma.contractFile.create({
          data: { contractId, snapshotId, kind: "ASSINADO", objectKey: key, sha256, sizeBytes: stored.size },
        });
      }
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.contract.updateMany({
          where: { id: contractId, status: "EM_ANDAMENTO" },
          data: { status: "AGUARDANDO_VALIDACAO", uploadError: null },
        });
        if (changed.count !== 1) return;
        const journey = await tx.journey.findFirst({
          where: { couple: { contract: { id: contractId } } },
          include: { steps: true },
        });
        const step = journey?.steps.find((item) => item.step === "CONTRATO");
        await tx.journeyStep.updateMany({
          where: { id: step?.id, status: "EM_ANDAMENTO" },
          data: { status: "AGUARDANDO_VALIDACAO" },
        });
      });
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      const lastTry = error instanceof UnrecoverableError || job.attemptsMade + 1 >= attempts;
      if (lastTry) {
        const message = error instanceof Error ? error.message : "Falha ao processar o arquivo.";
        await this.prisma.contract.update({ where: { id: contractId }, data: { uploadError: message } });
      }
      throw error;
    }
  }
}

@Injectable()
export class ScheduleBootstrap implements OnModuleInit {
  private readonly logger = new Logger(ScheduleBootstrap.name);

  constructor(
    private readonly reconcile: ReconcileService,
    @InjectQueue("deadlines") private readonly deadlines: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.deadlines.getRepeatableJobs();
    if (!existing.some((job) => job.name === "reconcile")) {
      await this.deadlines.add("reconcile", {}, { repeat: { pattern: "0 8 * * *", tz: "America/Sao_Paulo" } });
    }
    if (!existing.some((job) => job.name === "ops-check")) {
      await this.deadlines.add("ops-check", {}, { repeat: { pattern: "0 18 * * *", tz: "America/Sao_Paulo" } });
    }
    await this.reconcile.run();
    this.logger.log("Reconcile inicial executado e agendamentos conferidos.");
  }
}
