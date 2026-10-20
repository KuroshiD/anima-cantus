import { Controller, Get, Module, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { classifyRepertoireDeadline, formatDateBR, isoDate, todayIso } from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { AuthModule, SessionGuard } from "../auth/auth.module";
import { requireUser, type AuthUser } from "../../security";

type AuthRequest = Request & { user?: AuthUser };

@ApiTags("alertas")
@Controller("alertas")
@UseGuards(SessionGuard)
class AlertsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: AuthRequest) {
    const user = requireUser(req);
    if (!user.coupleId) return [];
    const [contract, journey, selections, moments, config] = await Promise.all([
      this.prisma.contract.findUnique({
        where: { coupleId: user.coupleId },
        include: { validations: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      this.prisma.journey.findUnique({ where: { coupleId: user.coupleId }, include: { steps: true } }),
      this.prisma.repertoireSelection.count({ where: { coupleId: user.coupleId, songTitle: { not: "" } } }),
      this.prisma.ceremonyMoment.count(),
      this.prisma.alertConfig.findUnique({ where: { id: "default" } }),
    ]);
    const alerts: { id: string; title: string; detail: string }[] = [];
    if (contract?.uploadError) alerts.push({ id: "upload", title: "Envio do contrato", detail: contract.uploadError });
    const refusal = contract?.validations[0];
    if (contract?.status === "EM_ANDAMENTO" && refusal && !refusal.accepted && refusal.reason) {
      alerts.push({ id: "refusal", title: "Contrato recusado", detail: refusal.reason });
    }
    if (contract?.status === "AGUARDANDO_VALIDACAO") {
      alerts.push({ id: "review", title: "Contrato em conferência", detail: "Avisaremos quando a equipe concluir a validação." });
    }
    const repertoire = journey?.steps.find((step) => step.step === "REPERTORIO");
    const end = journey?.repertoireWindowEnd ? isoDate(journey.repertoireWindowEnd) : null;
    const lead = config?.reminderLeadDays ?? 7;
    if (end) {
      const deadline = classifyRepertoireDeadline({
        status: repertoire?.status ?? "",
        filledCount: selections,
        momentCount: moments,
        windowEnd: end,
        today: todayIso(),
        leadDays: lead,
      });
      if (deadline !== "none") {
        alerts.push({
          id: "deadline",
          title: deadline === "overdue" ? "Repertório fora do prazo" : "Prazo do repertório",
          detail: `A janela recomendada termina em ${formatDateBR(end)}. Faltam ${moments - selections} música(s).`,
        });
      }
    }
    return alerts;
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AlertsController],
})
export class AlertsModule {}
