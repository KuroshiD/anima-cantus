import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export interface ContractPdfData {
  legalName: string;
  documentId: string;
  email: string;
  address: string;
  weddingDate: string; // dd/mm/aaaa
  weddingTime: string | null;
  venue: string;
  formation: string | null;
  additionalInstrumentistType: string | null;
  totalInWords: string;
  totalLabel: string;
  items: { name: string; priceLabel: string }[];
  /** Data de emissão do contrato (opcional; padrão: agora, fuso de São Paulo). */
  issuedAt?: Date;
}

// ---------------------------------------------------------------------------
// Dados fixos da CONTRATADA (confira antes de usar em produção)
// ---------------------------------------------------------------------------
const CONTRACTOR = {
  name: "Anima Cantus",
  document: "418.390.148-06",
  address: "Rua Zolinda Pagoto Roque, 51 – Jardim São Marcos, Jardinópolis - SP",
  representative: "Phillipe Tetsunari Tegoshi",
  pixKey: "animacantus3@gmail.com",
};
const CONTRACT_CITY = "Ribeirão Preto";
const FORO = "Ribeirão Preto/SP";
const PAYMENT_DAYS_BEFORE = 7;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 70;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const TEXT_W = PAGE_W - MARGIN_X * 2;
const INK = rgb(0.1, 0.1, 0.1);
const HEADING = rgb(0.19, 0.33, 0.55);
const MUTED = rgb(0.4, 0.4, 0.4);

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// As fontes padrão do PDF só suportam Latin-1; remove o que ficar fora.
function latin1(value: string): string {
  const cleaned = value
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-");
  let output = "";
  for (const char of cleaned) {
    if (char.charCodeAt(0) <= 255) output += char;
  }
  return output;
}

function longDateFromBR(value: string): string {
  const [d, m, y] = value.split("/").map(Number);
  if (!d || !m || !y) return value;
  return `${String(d).padStart(2, "0")} de ${MONTHS[m - 1]} de ${y}`;
}

function minusDaysLong(value: string, days: number): string {
  const [d, m, y] = value.split("/").map(Number);
  if (!d || !m || !y) return value;
  const date = new Date(Date.UTC(y, m - 1, d - days));
  return `${String(date.getUTCDate()).padStart(2, "0")} de ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

function issuedLong(date: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return `${String(get("day")).padStart(2, "0")} de ${MONTHS[get("month") - 1]} de ${get("year")}`;
}

// pdf-lib aplica kerning ao medir, mas não ao desenhar; medir caractere a
// caractere mantém a medida igual ao que realmente é desenhado.
function textWidth(font: PDFFont, text: string, size: number): number {
  let total = 0;
  for (const char of text) total += font.widthOfTextAtSize(char, size);
  return total;
}

type Run = { text: string; bold?: boolean };
type Word = { text: string; font: PDFFont };

export async function buildContractPdf(data: ContractPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  const ensureSpace = (height: number) => {
    if (y - height < MARGIN_BOTTOM) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_TOP;
    }
  };

  // Quebra de linha pela largura real do texto
  const layout = (runs: Run[], size: number, width: number, baseBold: boolean): Word[][] => {
    const words: Word[] = runs.flatMap((run) =>
      latin1(run.text)
        .split(/\s+/)
        .filter(Boolean)
        .map((text) => ({ text, font: run.bold || baseBold ? serifBold : serif })),
    );
    const space = textWidth(serif, " ", size);
    const lines: Word[][] = [];
    let line: Word[] = [];
    let lineW = 0;
    for (const word of words) {
      const w = textWidth(word.font, word.text, size);
      const needed = line.length ? lineW + space + w : w;
      if (line.length && needed > width) {
        lines.push(line);
        line = [word];
        lineW = w;
      } else {
        line.push(word);
        lineW = needed;
      }
    }
    if (line.length) lines.push(line);
    return lines;
  };

  const para = (
    runs: Run[] | string,
    opts: { size?: number; bold?: boolean; indent?: number; bullet?: boolean; after?: number; center?: boolean } = {},
  ) => {
    const { size = 11.5, bold = false, indent = 0, bullet = false, after = 6, center = false } = opts;
    const normalized: Run[] = typeof runs === "string" ? [{ text: runs }] : runs;
    const lineHeight = size * 1.4;
    const lines = layout(normalized, size, TEXT_W - indent, bold);
    const space = textWidth(serif, " ", size);
    lines.forEach((line, index) => {
      ensureSpace(lineHeight);
      const lineW = line.reduce((sum, w) => sum + textWidth(w.font, w.text, size), 0) + space * (line.length - 1);
      let x = center ? (PAGE_W - lineW) / 2 : MARGIN_X + indent;
      if (bullet && index === 0) {
        page.drawText("-", { x: MARGIN_X + indent - 12, y: y - size, size, font: serif, color: INK });
      }
      for (const word of line) {
        page.drawText(word.text, { x, y: y - size, size, font: word.font, color: INK });
        x += textWidth(word.font, word.text, size) + space;
      }
      y -= lineHeight;
    });
    y -= after;
  };

  const heading = (text: string) => {
    ensureSpace(70); // evita título sozinho no fim da página
    y -= 6;
    page.drawText(latin1(text), { x: MARGIN_X, y: y - 12.5, size: 12.5, font: sansBold, color: HEADING });
    y -= 12.5 * 1.4 + 3;
  };

  const field = (label: string, value: string) => para([{ text: `${label}:`, bold: true }, { text: value }], { after: 2 });

  // ----- Título -----
  para("CONTRATO DE PRESTAÇÃO DE SERVIÇOS MUSICAIS PARA CERIMÔNIA DE CASAMENTO", {
    size: 15,
    bold: true,
    center: true,
    after: 18,
  });

  // ----- Partes -----
  heading("CONTRATANTE:");
  field("Nome", data.legalName);
  field("CPF/CNPJ", data.documentId);
  field("E-mail", data.email);
  field("Endereço", data.address);
  y -= 6;

  heading("CONTRATADA:");
  field("Nome", CONTRACTOR.name);
  field("CNPJ/CPF", CONTRACTOR.document);
  field("Endereço", CONTRACTOR.address);
  field("Representante legal", CONTRACTOR.representative);
  y -= 6;

  // ----- Objeto -----
  heading("OBJETO DO CONTRATO:");
  para(
    "A prestação de serviços musicais pela equipe Anima Cantus para a cerimônia de casamento da CONTRATANTE, a ser realizada conforme os termos e condições descritos neste instrumento.",
  );

  // ----- 1. Serviços -----
  heading("1. Serviços Contratados:");
  para("A CONTRATADA se compromete a fornecer a seguinte formação musical para a cerimônia de casamento:", { after: 3 });
  const formationLines = (data.formation ?? "")
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of formationLines) para(line, { bullet: true, indent: 16, after: 1 });
  if (data.additionalInstrumentistType) {
    para(`Instrumentista adicional: ${data.additionalInstrumentistType}`, { bullet: true, indent: 16, after: 1 });
  }
  y -= 4;
  para("Além disso, a CONTRATADA fornecerá o aluguel de equipamento de som necessário para a execução dos serviços musicais.");

  // ----- 2. Local e data -----
  heading("2. Local e Data do Evento:");
  const time = data.weddingTime ? `com início às ${data.weddingTime} hrs` : "com horário a combinar";
  para(`A cerimônia ocorrerá em ${data.venue}, no dia ${longDateFromBR(data.weddingDate)}, ${time}.`);

  // ----- 3. Valor -----
  heading("3. Valor do Serviço e Condições de Pagamento:");
  para(`O valor total dos serviços prestados pela CONTRATADA é de ${data.totalLabel} (${data.totalInWords}), sendo:`, { after: 3 });
  for (const item of data.items) {
    para(`${item.priceLabel} referentes a ${item.name}`, { bullet: true, indent: 16, after: 1 });
  }
  y -= 4;
  para(
    `O pagamento total deverá ser realizado até ${PAYMENT_DAYS_BEFORE} dias antes do evento, ou seja, até o dia ${minusDaysLong(data.weddingDate, PAYMENT_DAYS_BEFORE)}. O pagamento poderá ser efetuado via transferência eletrônica para a conta da CONTRATADA. (Chave Pix: ${CONTRACTOR.pixKey}).`,
  );

  // ----- 4. Obrigações da contratada -----
  heading("4. Obrigações da Contratada:");
  para("A CONTRATADA se compromete a:", { after: 3 });
  para("a) Comparecer ao local do evento com, no mínimo, 1 (uma) hora de antecedência para a montagem e testes de som;", { after: 3 });
  para("b) Executar o repertório musical previamente acordado entre as partes, conforme orientação da CONTRATANTE;", { after: 3 });
  para("c) Fornecer todo o equipamento necessário para a execução dos serviços, exceto aqueles especificamente indicados como responsabilidade do local ou da CONTRATANTE;", { after: 3 });
  para("d) Havendo impossibilidade de participação de qualquer integrante da formação prevista, a CONTRATADA poderá substituí-lo por profissional de nível técnico e artístico equivalente, garantindo a qualidade do serviço.");

  // ----- 5. Obrigações da contratante -----
  heading("5. Obrigações da Contratante:");
  para("A CONTRATANTE se compromete a:", { after: 3 });
  para("a) Disponibilizar um local adequado para a apresentação e instalação dos equipamentos, com segurança, energia elétrica quando necessária e cobertura em eventos ao ar livre, especialmente sob sol direto (toldo, tenda ou sombrite);", { after: 3 });
  para("b) Efetuar o pagamento conforme as condições estabelecidas na Cláusula 3 deste contrato;", { after: 3 });
  para("c) Fornecer à CONTRATADA todas as informações e orientações pertinentes ao evento, com no mínimo 15 (quinze) dias de antecedência.");

  // ----- 6. Cancelamento -----
  heading("6. Cancelamento e Rescisão:");
  para("Em caso de cancelamento por qualquer das partes, será cobrada uma multa rescisória equivalente a 30% (trinta por cento) do valor total do contrato, salvo em casos de força maior, devidamente comprovados.");
  para("A CONTRATADA poderá rescindir o contrato se a CONTRATANTE não cumprir com as obrigações de pagamento, ou qualquer outra obrigação essencial, como fornecimento de informações necessárias para a execução dos serviços.");

  // ----- 7. Disposições gerais -----
  heading("7. Disposições Gerais:");
  para("a) Este contrato tem caráter irrevogável e irretratável, obrigando as partes e seus sucessores;", { after: 3 });
  para("b) Qualquer alteração ou aditamento a este contrato só terá validade se formalizado por escrito e assinado por ambas as partes;", { after: 3 });
  para(`c) Fica eleito o foro da comarca de ${FORO} para dirimir quaisquer dúvidas ou controvérsias decorrentes deste contrato.`, { after: 14 });

  // ----- Fecho e assinaturas (mantidos juntos na mesma página) -----
  ensureSpace(260);
  para("Por estarem de pleno acordo com as disposições ora estabelecidas, as partes assinam o presente contrato em duas vias de igual teor, juntamente com duas testemunhas, para que produza os devidos efeitos legais.", { after: 18 });
  para(`${CONTRACT_CITY}, ${issuedLong(data.issuedAt ?? new Date())}.`, { after: 40 });

  const signature = (name: string, role: string) => {
    ensureSpace(60);
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: MARGIN_X + 230, y },
      thickness: 0.8,
      color: INK,
    });
    y -= 4;
    para(name, { after: 0 });
    para(role, { after: 34 });
  };
  signature(data.legalName, "Contratante");
  signature(CONTRACTOR.representative, "Contratada");

  para(
    "Assinatura eletrônica realizada no gov.br, em conta prata ou ouro. O arquivo assinado deve ser enviado na área do casal para conferência da equipe Anima Cantus.",
    { size: 9, after: 0 },
  );

  // ----- Rodapé: numeração -----
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    const label = `Página ${index + 1} de ${pages.length}`;
    const w = textWidth(serif, label, 9);
    p.drawText(label, { x: (PAGE_W - w) / 2, y: 36, size: 9, font: serif, color: MUTED });
  });

  doc.setTitle("Contrato Anima Cantus");
  doc.setAuthor("Anima Cantus");
  return doc.save();
}