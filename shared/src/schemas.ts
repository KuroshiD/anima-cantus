import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD.");

export const LEGAL_VERSION = "2026-10-19";

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter ao menos 8 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa incluir uma letra.")
  .regex(/[0-9]/, "A senha precisa incluir um número.");

export const registerSchema = z.object({
  partnerOne: z.string().trim().min(2, "Informe o nome da primeira pessoa."),
  partnerTwo: z.string().trim().min(2, "Informe o nome da segunda pessoa."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: passwordSchema,
  phone: z.string().trim().min(8, "Informe um telefone com DDD."),
  weddingDate: isoDate,
  venue: z.string().trim().min(2, "Informe o local.").optional().or(z.literal("")),
  termsVersion: z.string().min(1, "Aceite os termos para continuar."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Link inválido."),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20, "Link inválido."),
});

export const budgetSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome."),
  phone: z.string().trim().min(8, "Informe um telefone com DDD."),
  email: z.string().trim().email("Informe um e-mail válido.").optional().or(z.literal("")),
  weddingDate: isoDate.optional().or(z.literal("")),
  venue: z.string().trim().max(160).optional().or(z.literal("")),
  hasPlanner: z.boolean(),
  source: z.string().trim().min(2, "Conte como nos conheceu."),
});

export const contractDraftSchema = z.object({
  legalName: z.string().trim().min(3, "Informe o nome ou a razão social."),
  documentId: z
    .string()
    .trim()
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length === 11 || digits.length === 14;
    }, "Informe um CPF ou CNPJ."),
  address: z.string().trim().min(5, "Informe o endereço."),
  email: z.string().trim().email("Informe um e-mail válido."),
  phone: z.string().trim().min(8, "Informe um telefone."),
  weddingDate: isoDate,
  weddingTime: z.string().trim().min(4, "Informe o horário."),
  venue: z.string().trim().min(2, "Informe o local."),
  formation: z.string().trim().max(200).optional().or(z.literal("")),
  paymentTerms: z.string().trim().min(3, "Informe a condição de pagamento."),
  serviceIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um serviço."),
});

export const repertoireSaveSchema = z.object({
  selections: z
    .array(
      z.object({
        momentId: z.string().uuid(),
        songTitle: z.string().trim().max(160),
      }),
    )
    .min(1),
});

export const uploadIntentSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024, "O PDF deve ter no máximo 10 MB."),
  contentType: z.literal("application/pdf"),
});

export const uploadConfirmSchema = z.object({
  key: z.string().trim().min(8).max(400),
});

export const rejectContractSchema = z.object({
  reason: z.string().trim().min(5, "Descreva o motivo da recusa.").max(500),
});

export const serviceWriteSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  kind: z.enum(["PACOTE", "SERVICO", "ADICIONAL"]),
  priceCents: z.number().int().nonnegative(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const alertConfigSchema = z.object({
  reminderLeadDays: z.number().int().min(0).max(60),
});

export const contentWriteSchema = z.object({
  value: z.string().trim().min(1).max(5000),
});

export const musicTipWriteSchema = z.object({
  momentId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  artist: z.string().trim().max(160).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export const galleryWriteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  mediaUrl: z.string().trim().min(1).max(400),
  kind: z.enum(["foto", "video"]),
  altText: z.string().trim().min(3).max(200),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type ContractDraftInput = z.infer<typeof contractDraftSchema>;
export type RepertoireSaveInput = z.infer<typeof repertoireSaveSchema>;
