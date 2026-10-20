import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import {
  alertConfigSchema,
  contentWriteSchema,
  classifyRepertoireDeadline,
  formatBRL,
  formatDateBR,
  galleryWriteSchema,
  isoDate,
  musicTipWriteSchema,
  rejectContractSchema,
  todayIso,
} from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { StorageService } from "../../storage.service";
import { NotificationsService } from "../../notifications.service";
import { ReconcileService } from "../../reconcile.service";
import { AuthModule, SessionGuard } from "../auth/auth.module";
import { Roles, RolesGuard, type AuthUser } from "../../security";
import { contractTransition, journeyAfterContractDecision } from "../../transitions";
import { Req } from "@nestjs/common";
import type { Request } from "express";

class RejectDto extends createZodDto(rejectContractSchema) {}
class AlertDto extends createZodDto(alertConfigSchema) {}
class ContentDto extends createZodDto(contentWriteSchema) {}
class TipDto extends createZodDto(musicTipWriteSchema) {}
class GalleryDto extends createZodDto(galleryWriteSchema) {}

@ApiTags("admin")
@Controller("admin")
@UseGuards(SessionGuard, RolesGuard)
@Roles("ADMIN")
class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly reconcileService: ReconcileService,
  ) {}

  @Get("painel")
  async panel() {
    const [couples, moments, config] = await Promise.all([
      this.prisma.couple.findMany({
        include: {
          user: { select: { email: true } },
          contract: { include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } } },
          journey: { include: { steps: true } },
          selections: true,
        },
        orderBy: { weddingDate: "asc" },
      }),
      this.prisma.ceremonyMoment.count(),
      this.prisma.alertConfig.findUnique({ where: { id: "default" } }),
    ]);
    const lead = config?.reminderLeadDays ?? 7;
    const today = todayIso();
    return couples.map((couple) => {
      const snapshot = couple.contract?.snapshots[0];
      const steps = Object.fromEntries((couple.journey?.steps ?? []).map((step) => [step.step, step.status]));
      const chosen = couple.selections.filter((selection) => selection.songTitle.trim()).length;
      const end = couple.journey?.repertoireWindowEnd ? isoDate(couple.journey.repertoireWindowEnd) : null;
      const deadline = end
        ? classifyRepertoireDeadline({
            status: String(steps.REPERTORIO ?? ""),
            filledCount: chosen,
            momentCount: moments,
            windowEnd: end,
            today,
            leadDays: lead,
          })
        : "none";
      const flags: string[] = [];
      if (couple.contract?.status === "AGUARDANDO_VALIDACAO") flags.push("Contrato aguardando conferência");
      if (deadline === "overdue") flags.push("Repertório atrasado");
      if (deadline === "approaching") flags.push("Repertório perto do prazo");
      if (isoDate(couple.weddingDate) < today && steps.CASAMENTO !== "CONCLUIDA") flags.push("Casamento ainda não registrado");
      return {
        id: couple.id,
        name: `${couple.partnerOne} & ${couple.partnerTwo}`,
        email: couple.user?.email ?? couple.email,
        weddingDate: isoDate(couple.weddingDate),
        weddingLabel: formatDateBR(isoDate(couple.weddingDate)),
        totalLabel: snapshot ? formatBRL(snapshot.totalCents) : "—",
        contractStatus: couple.contract?.status ?? null,
        contractId: couple.contract?.id ?? null,
        repertoire: `${chosen}/${moments}`,
        steps,
        flags,
      };
    });
  }

  @Get("casais/:id")
  async couple(@Param("id") id: string) {
    const couple = await this.prisma.couple.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, emailVerifiedAt: true } },
        journey: { include: { steps: true } },
        selections: { include: { moment: true } },
        contract: {
          include: {
            snapshots: { orderBy: { createdAt: "desc" } },
            files: { orderBy: { createdAt: "desc" } },
            validations: { orderBy: { createdAt: "desc" }, include: { admin: { select: { email: true } } } },
          },
        },
      },
    });
    if (!couple) throw new NotFoundException("Casal não encontrado.");
    return couple;
  }

  @Post("contratos/:id/validar")
  validate(@Param("id") id: string, @Req() req: Request & { user?: AuthUser }) {
    return this.decide(id, req.user!.userId, true);
  }

  @Post("contratos/:id/recusar")
  reject(@Param("id") id: string, @Body() body: RejectDto, @Req() req: Request & { user?: AuthUser }) {
    return this.decide(id, req.user!.userId, false, body.reason);
  }

  @Post("casais/:id/casamento")
  async wedding(@Param("id") id: string) {
    const journey = await this.prisma.journey.findUniqueOrThrow({ where: { coupleId: id }, include: { steps: true } });
    const wedding = journey.steps.find((step) => step.step === "CASAMENTO");
    const after = journey.steps.find((step) => step.step === "POS_EVENTO");
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.journeyStep.updateMany({
        where: { id: wedding?.id, status: "EM_ANDAMENTO" },
        data: { status: "CONCLUIDA" },
      });
      if (updated.count !== 1) throw new NotFoundException("O casamento não está em andamento.");
      await tx.journeyStep.updateMany({
        where: { id: after?.id, status: "PENDENTE" },
        data: { status: "EM_ANDAMENTO" },
      });
    });
    return { message: "Casamento registrado. O histórico permanece disponível." };
  }

  @Get("contratos/:id/arquivos/:fileId/download")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'attachment; filename="contrato-anima-cantus.pdf"')
  @Header("X-Content-Type-Options", "nosniff")
  async download(@Param("id") id: string, @Param("fileId") fileId: string) {
    const file = await this.prisma.contractFile.findFirst({ where: { id: fileId, contractId: id } });
    if (!file) throw new NotFoundException("Arquivo não encontrado.");
    const stored = await this.storage.read(file.objectKey);
    return new StreamableFile(stored.body);
  }

  @Patch("alertas")
  alerts(@Body() body: AlertDto) {
    return this.prisma.alertConfig.upsert({
      where: { id: "default" },
      create: { id: "default", reminderLeadDays: body.reminderLeadDays },
      update: { reminderLeadDays: body.reminderLeadDays },
    });
  }

  @Get("alertas")
  alertConfig() {
    return this.prisma.alertConfig.findUnique({ where: { id: "default" } });
  }

  @Get("dicas")
  async tips() {
    const [moments, tips] = await Promise.all([
      this.prisma.ceremonyMoment.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.musicTip.findMany({
        include: { moment: true },
        orderBy: [{ moment: { sortOrder: "asc" } }, { title: "asc" }],
      }),
    ]);
    return { moments, tips };
  }

  @Patch("conteudo/:key")
  content(@Param("key") key: string, @Body() body: ContentDto) {
    return this.prisma.siteContent.upsert({
      where: { key },
      create: { key, value: body.value },
      update: { value: body.value },
    });
  }

  @Get("galeria")
  gallery() {
    return this.prisma.galleryItem.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
  }

  @Post("dicas")
  createTip(@Body() body: TipDto) {
    return this.prisma.musicTip.create({
      data: {
        momentId: body.momentId ?? null,
        title: body.title,
        artist: body.artist || null,
        note: body.note || null,
        active: body.active ?? true,
      },
    });
  }

  @Patch("dicas/:id")
  updateTip(@Param("id") id: string, @Body() body: TipDto) {
    return this.prisma.musicTip.update({
      where: { id },
      data: {
        momentId: body.momentId ?? null,
        title: body.title,
        artist: body.artist || null,
        note: body.note || null,
        active: body.active ?? true,
      },
    });
  }

  @Post("galeria")
  createGallery(@Body() body: GalleryDto) {
    return this.prisma.galleryItem.create({
      data: { ...body, sortOrder: body.sortOrder ?? 0, active: body.active ?? true },
    });
  }

  @Patch("galeria/:id")
  updateGallery(@Param("id") id: string, @Body() body: GalleryDto) {
    return this.prisma.galleryItem.update({
      where: { id },
      data: { ...body, sortOrder: body.sortOrder ?? 0, active: body.active ?? true },
    });
  }

  @Post("reconciliar")
  reconcile() {
    return this.reconcileService.run();
  }

  private async decide(contractId: string, adminUserId: string, accepted: boolean, reason?: string) {
    const contract = await this.prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
      include: { couple: { include: { user: true, journey: { include: { steps: true } } } } },
    });
    const next = accepted ? "CONCLUIDA" : "EM_ANDAMENTO";
    const transition = contractTransition(contract.status, next);
    if (!transition.ok) {
      throw new ConflictException("O contrato não está em um estado que permita essa ação.");
    }
    const effect = journeyAfterContractDecision(accepted);
    const steps = contract.couple.journey?.steps ?? [];
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.contract.updateMany({
        where: { id: contractId, status: "AGUARDANDO_VALIDACAO" },
        data: { status: next },
      });
      if (changed.count !== 1) throw new NotFoundException("O contrato não está aguardando validação.");
      await tx.journeyStep.updateMany({
        where: { id: steps.find((step) => step.step === "CONTRATO")?.id, status: "AGUARDANDO_VALIDACAO" },
        data: { status: effect.contract },
      });
      if (effect.repertorio) {
        await tx.journeyStep.updateMany({
          where: { id: steps.find((step) => step.step === "REPERTORIO")?.id, status: effect.repertorio.from },
          data: { status: effect.repertorio.to },
        });
      }
      await tx.contractValidation.create({
        data: { contractId, adminUserId, accepted, reason: reason ?? null },
      });
    });
    const email = contract.couple.user?.email;
    if (email) {
      await this.notifications.enqueue("notifications", "send", {
        type: accepted ? "CONTRACT_VALIDATED" : "CONTRACT_REJECTED",
        entityType: "contract",
        entityId: contractId,
        reference: `${accepted ? "ok" : "no"}:${Date.now()}`,
        to: email,
        subject: accepted ? "Contrato validado — Anima Cantus" : "Contrato precisa de ajuste — Anima Cantus",
        text: accepted
          ? "Validamos o contrato assinado. O repertório já está liberado na área de vocês."
          : `Ainda não conseguimos concluir o contrato. Motivo: ${reason}`,
      });
    }
    return { message: accepted ? "Contrato concluído." : "Contrato devolvido ao casal." };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [RolesGuard],
})
export class AdminModule {}
