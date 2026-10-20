import { Body, Controller, ForbiddenException, Get, Module, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import type { Request } from "express";
import { formatDateBR, isoDate, repertoireSaveSchema } from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { AuthModule, SessionGuard } from "../auth/auth.module";
import { requireCoupleId, type AuthUser } from "../../security";

class SaveDto extends createZodDto(repertoireSaveSchema) {}
type AuthRequest = Request & { user?: AuthUser };

@ApiTags("repertorio")
@Controller("repertorio")
@UseGuards(SessionGuard)
class RepertoireController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Req() req: AuthRequest) {
    const coupleId = requireCoupleId(req);
    const [moments, selections, journey, config] = await Promise.all([
      this.prisma.ceremonyMoment.findMany({
        orderBy: { sortOrder: "asc" },
        include: { tips: { where: { active: true }, orderBy: { title: "asc" } } },
      }),
      this.prisma.repertoireSelection.findMany({ where: { coupleId } }),
      this.prisma.journey.findUniqueOrThrow({ where: { coupleId }, include: { steps: true } }),
      this.prisma.alertConfig.findUnique({ where: { id: "default" } }),
    ]);
    const contract = journey.steps.find((step) => step.step === "CONTRATO");
    const repertoire = journey.steps.find((step) => step.step === "REPERTORIO");
    return {
      locked: contract?.status !== "CONCLUIDA",
      status: repertoire?.status ?? "PENDENTE",
      window: {
        start: journey.repertoireWindowStart ? isoDate(journey.repertoireWindowStart) : null,
        end: journey.repertoireWindowEnd ? isoDate(journey.repertoireWindowEnd) : null,
        startLabel: journey.repertoireWindowStart ? formatDateBR(isoDate(journey.repertoireWindowStart)) : null,
        endLabel: journey.repertoireWindowEnd ? formatDateBR(isoDate(journey.repertoireWindowEnd)) : null,
      },
      reminderLeadDays: config?.reminderLeadDays ?? 7,
      moments: moments.map((moment) => ({
        id: moment.id,
        name: moment.name,
        song: selections.find((selection) => selection.momentId === moment.id)?.songTitle ?? "",
        tips: moment.tips.map((tip) => ({ id: tip.id, title: tip.title, artist: tip.artist, note: tip.note })),
      })),
    };
  }

  @Put()
  async save(@Req() req: AuthRequest, @Body() body: SaveDto) {
    const coupleId = await this.assertOpen(req);
    const moments = await this.prisma.ceremonyMoment.findMany({ select: { id: true } });
    const allowed = new Set(moments.map((moment) => moment.id));
    await this.prisma.$transaction(
      body.selections
        .filter((selection) => allowed.has(selection.momentId))
        .map((selection) =>
          this.prisma.repertoireSelection.upsert({
            where: { coupleId_momentId: { coupleId, momentId: selection.momentId } },
            create: { coupleId, momentId: selection.momentId, songTitle: selection.songTitle },
            update: { songTitle: selection.songTitle },
          }),
        ),
    );
    return { message: "Progresso salvo." };
  }

  @Post("concluir")
  async complete(@Req() req: AuthRequest) {
    const coupleId = await this.assertOpen(req);
    const [moments, selections, journey] = await Promise.all([
      this.prisma.ceremonyMoment.findMany(),
      this.prisma.repertoireSelection.findMany({ where: { coupleId } }),
      this.prisma.journey.findUniqueOrThrow({ where: { coupleId }, include: { steps: true } }),
    ]);
    const missing = moments.some((moment) => !selections.find((selection) => selection.momentId === moment.id && selection.songTitle.trim()));
    if (missing) throw new ForbiddenException("Escolha uma música para cada momento antes de concluir.");
    const repertoire = journey.steps.find((step) => step.step === "REPERTORIO");
    const wedding = journey.steps.find((step) => step.step === "CASAMENTO");
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.journeyStep.updateMany({
        where: { id: repertoire?.id, status: "EM_ANDAMENTO" },
        data: { status: "CONCLUIDA" },
      });
      if (updated.count !== 1) throw new ForbiddenException("O repertório não está em andamento.");
      await tx.journeyStep.updateMany({
        where: { id: wedding?.id, status: "PENDENTE" },
        data: { status: "EM_ANDAMENTO" },
      });
    });
    return { message: "Repertório concluído." };
  }

  private async assertOpen(req: AuthRequest): Promise<string> {
    const coupleId = requireCoupleId(req);
    const journey = await this.prisma.journey.findUniqueOrThrow({ where: { coupleId }, include: { steps: true } });
    const contract = journey.steps.find((step) => step.step === "CONTRATO");
    const repertoire = journey.steps.find((step) => step.step === "REPERTORIO");
    if (contract?.status !== "CONCLUIDA" || repertoire?.status !== "EM_ANDAMENTO") {
      throw new ForbiddenException("O repertório ainda não está liberado para edição.");
    }
    return coupleId;
  }
}

@Module({
  imports: [AuthModule],
  controllers: [RepertoireController],
})
export class RepertoireModule {}
