export const roles = ["COUPLE", "ADMIN"] as const;
export type Role = (typeof roles)[number];

export const journeySteps = [
  "CADASTRO",
  "CONTRATO",
  "REPERTORIO",
  "CASAMENTO",
  "POS_EVENTO",
] as const;
export type JourneyStepKey = (typeof journeySteps)[number];

export const stageStatuses = [
  "PENDENTE",
  "EM_ANDAMENTO",
  "AGUARDANDO_VALIDACAO",
  "CONCLUIDA",
] as const;
export type StageStatus = (typeof stageStatuses)[number];

export const contractStatuses = [
  "EM_ANDAMENTO",
  "AGUARDANDO_VALIDACAO",
  "CONCLUIDA",
] as const;
export type ContractStatus = (typeof contractStatuses)[number];

export const serviceKinds = ["PACOTE", "SERVICO", "ADICIONAL"] as const;
export type ServiceKind = (typeof serviceKinds)[number];

export const fileKinds = ["GERADO", "ASSINADO"] as const;
export type FileKind = (typeof fileKinds)[number];

export const notificationChannels = ["EMAIL", "WHATSAPP"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationDeliveries = ["ENVIADO", "FALHOU"] as const;
export type NotificationDelivery = (typeof notificationDeliveries)[number];

export const stepLabels: Record<JourneyStepKey, string> = {
  CADASTRO: "Cadastro",
  CONTRATO: "Contrato",
  REPERTORIO: "Repertório",
  CASAMENTO: "Casamento",
  POS_EVENTO: "Pós-evento",
};

export const statusLabels: Record<StageStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_VALIDACAO: "Aguardando validação",
  CONCLUIDA: "Concluída",
};
