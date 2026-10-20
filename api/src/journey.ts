import { formatDateBR, type JourneyStepKey, type StageStatus } from "@anima/shared";

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

export type JourneyNextAction = {
  title: string;
  description: string;
  href: string;
};

export function nextJourneyAction(input: {
  current: { key: JourneyStepKey; status: StageStatus } | undefined;
  weddingDate: string;
  hasSnapshot: boolean;
}): JourneyNextAction | null {
  const current = input.current;
  if (!current) return null;
  if (current.key === "CONTRATO" && current.status === "EM_ANDAMENTO") {
    if (input.hasSnapshot) {
      return {
        title: "Assine o contrato",
        description: "O documento já está pronto. Baixe, assine pelo GOV.BR e envie para conferência.",
        href: "/contrato",
      };
    }
    return {
      title: "Monte o contrato",
      description: "Preencha os dados, escolha os serviços e gere o PDF.",
      href: "/contrato",
    };
  }
  if (current.key === "CONTRATO") {
    return {
      title: "Contrato em conferência",
      description: "Recebemos o arquivo assinado. A equipe vai confirmar para liberar o repertório.",
      href: "/contrato",
    };
  }
  if (current.key === "REPERTORIO") {
    return {
      title: "Monte o repertório",
      description: "Escolha uma música para cada momento da cerimônia.",
      href: "/repertorio",
    };
  }
  if (current.key === "CASAMENTO") {
    return {
      title: "O grande dia",
      description: `A cerimônia está marcada para ${formatDateBR(input.weddingDate)}.`,
      href: "/jornada",
    };
  }
  return {
    title: "Depois do casamento",
    description: "Guardamos a história de vocês e escrevemos de novo daqui a um ano.",
    href: "/jornada",
  };
}
