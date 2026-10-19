import { ConflictException } from "@nestjs/common";
import type { StageStatus } from "@anima/shared";

const contractTransitions: Record<string, StageStatus[]> = {
  EM_ANDAMENTO: ["AGUARDANDO_VALIDACAO"],
  AGUARDANDO_VALIDACAO: ["CONCLUIDA", "EM_ANDAMENTO"],
};

export function assertContractTransition(from: string, to: StageStatus): void {
  if (!contractTransitions[from]?.includes(to)) {
    throw new ConflictException("O contrato não está em um estado que permita essa ação.");
  }
}

export function journeyAfterContractDecision(accepted: boolean): {
  contract: StageStatus;
  repertorio?: { from: StageStatus; to: StageStatus };
} {
  if (accepted) {
    return {
      contract: "CONCLUIDA",
      repertorio: { from: "PENDENTE", to: "EM_ANDAMENTO" },
    };
  }
  return { contract: "EM_ANDAMENTO" };
}
