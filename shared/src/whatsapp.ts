export interface BudgetMessageInput {
  name: string;
  phone: string;
  email?: string | null;
  weddingDate?: string | null;
  venue?: string | null;
  hasPlanner?: boolean | null;
  source?: string | null;
}

export function whatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function whatsAppLink(phone: string, text: string): string {
  return `https://wa.me/${whatsAppDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export function budgetWhatsAppText(input: BudgetMessageInput): string {
  const lines = [
    "Olá! Recebi o pedido de orçamento do site Anima Cantus.",
    `Nome: ${input.name}`,
    `Telefone: ${input.phone}`,
    input.email ? `E-mail: ${input.email}` : "",
    input.weddingDate ? `Data da cerimônia: ${input.weddingDate.split("-").reverse().join("/")}` : "",
    input.venue ? `Local: ${input.venue}` : "",
    input.hasPlanner == null ? "" : `Cerimonialista: ${input.hasPlanner ? "sim" : "não"}`,
    input.source ? `Como nos conheceu: ${input.source}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function contactWhatsAppText(): string {
  return "Olá! Vim pelo site do Anima Cantus e gostaria de falar com a equipe.";
}
