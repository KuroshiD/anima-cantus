import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  daysUntil,
  formatDateBR,
  statusLabels,
  stepLabels,
  type JourneyStepKey,
  type StageStatus,
} from "@anima/shared";
import { PrismaService } from "../../prisma.service";
import { AuthModule, SessionGuard } from "../auth/auth.module";
import { requireUser, type AuthUser } from "../../security";
import { Req } from "@nestjs/common";
import type { Request } from "express";
import { isoDate } from "../../dates.util";

const order: JourneyStepKey[] = ["CADASTRO", "CONTRATO", "REPERTORIO", "CASAMENTO", "POS_EVENTO"];

export function describeStep(step: JourneyStepKey, status: StageStatus, weddingDate: string): string {
  if (step === "CADASTRO") return status === "CONCLUIDA" ? "Perfil criado" : "Complete seu cadastro";
  if (step === "CONTRATO" && status === "EM_ANDAMENTO") return "Aguardando sua assinatura";
  if (step === "CONTRATO" && status === "AGUARDANDO_VALIDACAO") return "A equipe está conferindo o documento";
  if (step === "CONTRATO" && status === "CONCLUIDA") return "Contrato validado";
  if (step === "REPERTORIO" && status === "PENDENTE") return "Liberado após o contrato";
  if (step === "REPERTORIO" && status === "EM_ANDAMENTO") return "Escolha as músicas da cerimônia";
  if (step === "REPERTORIO" && status === "CONCLUIDA") return "Repertório definido";
  if (step === "CASAMENTO") return formatDateBR(weddingDate);
  return status === "CONCLUIDA" ? "Mensagem de um ano enviada" : "Uma lembrança especial";
}

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
    const next = !current
      ? null
      : current.key === "CONTRATO" && current.status === "EM_ANDAMENTO"
        ? {
            title: hasSnapshot ? "Assine o contrato" : "Monte o contrato",
            description: hasSnapshot
              ? "O documento já está pronto. Baixe, assine pelo GOV.BR e envie para conferência."
              : "Preencha os dados, escolha os serviços e gere o PDF.",
            href: "/contrato",
          }
        : current.key === "CONTRATO"
          ? {
              title: "Contrato em conferência",
              description: "Recebemos o arquivo assinado. A equipe vai confirmar para liberar o repertório.",
              href: "/contrato",
            }
          : current.key === "REPERTORIO"
            ? {
                title: "Monte o repertório",
                description: "Escolha uma música para cada momento da cerimônia.",
                href: "/repertorio",
              }
            : current.key === "CASAMENTO"
              ? {
                  title: "O grande dia",
                  description: `A cerimônia está marcada para ${formatDateBR(weddingDate)}.`,
                  href: "/jornada",
                }
              : {
                  title: "Depois do casamento",
                  description: "Guardamos a história de vocês e escrevemos de novo daqui a um ano.",
                  href: "/jornada",
                };
    return {
      coupleName: `${couple.partnerOne} & ${couple.partnerTwo}`,
      weddingDate,
      daysRemaining: daysUntil(weddingDate),
      updatedLabel: "Atualizado hoje",
      progress: { completed, total: 5, percent: Math.round((completed / 5) * 100) },
      next,
      steps,
    };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [JourneyController],
})
export class JourneyModule {}
