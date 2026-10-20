import type { StageStatus } from "@anima/shared";

const contractTransitions: Record<string, StageStatus[]> = {
  EM_ANDAMENTO: ["AGUARDANDO_VALIDACAO"],
  AGUARDANDO_VALIDACAO: ["CONCLUIDA", "EM_ANDAMENTO"],
};

export type ContractTransitionResult =
  | { ok: true }
  | { ok: false; reason: "INVALID_CONTRACT_TRANSITION" };

export function contractTransition(from: string, to: StageStatus): ContractTransitionResult {
  if (!contractTransitions[from]?.includes(to)) {
    return { ok: false, reason: "INVALID_CONTRACT_TRANSITION" };
  }
  return { ok: true };
}

export function journeyAfterContractDecision(accepted: boolean): {
  contract: StageStatus;
  repertorio?: { from: StageStatus; to: StageStatus };
} {
  if (!accepted) return { contract: "EM_ANDAMENTO" };
  return {
    contract: "CONCLUIDA",
    repertorio: { from: "PENDENTE", to: "EM_ANDAMENTO" },
  };
}
