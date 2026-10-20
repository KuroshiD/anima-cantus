import type { JourneyStepKey, StageStatus } from "@anima/shared";

export interface SessionState {
  authenticated: boolean;
  role?: "COUPLE" | "ADMIN";
  email?: string;
  coupleId?: string | null;
}

export interface JourneyView {
  coupleName: string;
  weddingDate: string;
  daysRemaining: number;
  updatedLabel: string;
  progress: { completed: number; total: number; percent: number };
  next: { title: string; description: string; href: string } | null;
  steps: { key: JourneyStepKey; name: string; status: StageStatus; label: string; description: string }[];
}

export interface ContractView {
  id: string;
  status: StageStatus;
  uploadError: string | null;
  serviceIds: string[];
  couple: {
    partnerOne: string;
    partnerTwo: string;
    legalName: string;
    documentId: string;
    address: string;
    email: string;
    phone: string;
    weddingDate: string;
    weddingTime: string;
    venue: string;
    formation: string;
    paymentTerms: string;
  };
  discountCents: number;
  catalog: { id: string; name: string; description: string | null; kind: "PACOTE" | "SERVICO" | "ADICIONAL"; priceCents: number }[];
  latest: {
    id: string;
    totalCents: number;
    totalInWords: string;
    totalLabel: string;
    items: { serviceId: string; name: string; kind: string; priceLabel: string; priceCents: number }[];
  } | null;
  files: { id: string; kind: "GERADO" | "ASSINADO"; sha256: string; sizeBytes: number }[];
  validations: { accepted: boolean; reason: string | null }[];
  limitation: string;
}

export interface RepertoireView {
  locked: boolean;
  status: StageStatus;
  window: { startLabel: string | null; endLabel: string | null };
  moments: { id: string; name: string; song: string; tips: { id: string; title: string; artist: string | null; note: string | null }[] }[];
}

export interface AdminCoupleRow {
  id: string;
  name: string;
  email: string | null;
  weddingDate: string;
  weddingLabel: string;
  totalLabel: string;
  contractStatus: string | null;
  contractId: string | null;
  repertoire: string;
  steps: Record<string, string>;
  flags: string[];
}

export interface AdminCoupleDetailData {
  id: string;
  partnerOne: string;
  partnerTwo: string;
  phone: string | null;
  email: string | null;
  legalName: string | null;
  documentId: string | null;
  address: string | null;
  weddingDate: string;
  weddingTime: string | null;
  venue: string | null;
  formation: string | null;
  paymentTerms: string | null;
  user: { email: string; emailVerifiedAt: string | null } | null;
  journey: { steps: { id: string; step: string; status: string }[] } | null;
  selections: { id: string; songTitle: string; moment: { name: string } }[];
  contract: {
    id: string;
    status: string;
    uploadError: string | null;
    snapshots: { id: string; totalCents: number; totalInWords: string; paymentTerms: string; createdAt: string }[];
    files: { id: string; kind: string; sha256: string; sizeBytes: number; createdAt: string }[];
    validations: { accepted: boolean; reason: string | null; createdAt: string; admin: { email: string } }[];
  } | null;
}

export interface ServiceItemView {
  id: string;
  name: string;
  description: string | null;
  kind: "PACOTE" | "SERVICO" | "ADICIONAL";
  priceCents: number;
  active: boolean;
  sortOrder: number;
}

export interface AdminTipView {
  id: string;
  momentId: string | null;
  title: string;
  artist: string | null;
  note: string | null;
  active: boolean;
  moment: { id: string; name: string; sortOrder: number } | null;
}

export interface AdminGalleryView {
  id: string;
  title: string;
  mediaUrl: string;
  kind: string;
  altText: string;
  sortOrder: number;
  active: boolean;
}

export interface AdminTipsResponse {
  moments: { id: string; name: string; sortOrder: number }[];
  tips: AdminTipView[];
}

export interface PublicContentView {
  pages: Record<string, string>;
  tips: { id: string; title: string; artist: string | null; note: string | null; moment: string }[];
  gallery: AdminGalleryView[];
  whatsAppPhone: string;
  instagram: string;
}
