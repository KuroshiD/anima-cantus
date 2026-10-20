import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  daysUntil,
  isoDate,
  statusLabels,
  stepLabels,
  type JourneyStepKey,
  type StageStatus,
} from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { AuthModule, SessionGuard } from "../auth/auth.module";
import { requireUser, type AuthUser } from "../../security";
import { describeStep, nextJourneyAction } from "../../journey";
import { Req } from "@nestjs/common";
import type { Request } from "express";

const order: JourneyStepKey[] = ["CADASTRO", "CONTRATO", "REPERTORIO", "CASAMENTO", "POS_EVENTO"];

@ApiTags("jornada")
@Controller("jornada")
@UseGuards(SessionGuard)
class JourneyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Req() req: Request & { user?: AuthUser }) {
    const user = requireUser(req);
    if (!user.coupleId) return { role: user.role };
    const couple = await this.prisma.couple.findUniqueOrThrow({
      where: { id: user.coupleId },
      include: { journey: { include: { steps: true } }, contract: { include: { snapshots: true } } },
    });
    const weddingDate = isoDate(couple.weddingDate);
    const steps = order.map((key) => {
      const row = couple.journey?.steps.find((step) => step.step === key);
      const status = (row?.status ?? "PENDENTE") as StageStatus;
      return {
        key,
        name: stepLabels[key],
        status,
        label: statusLabels[status],
        description: describeStep(key, status, weddingDate),
      };
    });
    const completed = steps.filter((step) => step.status === "CONCLUIDA").length;
    const current = steps.find((step) => step.status !== "CONCLUIDA");
    const hasSnapshot = (couple.contract?.snapshots.length ?? 0) > 0;
    return {
      coupleName: `${couple.partnerOne} & ${couple.partnerTwo}`,
      weddingDate,
      daysRemaining: daysUntil(weddingDate),
      updatedLabel: "Atualizado hoje",
      progress: { completed, total: order.length, percent: Math.round((completed / order.length) * 100) },
      next: nextJourneyAction({ current, weddingDate, hasSnapshot }),
      steps,
    };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [JourneyController],
})
export class JourneyModule {}
