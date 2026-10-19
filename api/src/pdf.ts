import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ContractPdfData {
  legalName: string;
  documentId: string;
  email: string;
  phone: string;
  address: string;
  weddingDate: string;
  weddingTime: string | null;
  venue: string;
  formation: string | null;
  paymentTerms: string;
  totalInWords: string;
  totalLabel: string;
  items: { name: string; priceLabel: string }[];
}

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

function wrap(text: string, max: number): string[] {
  const words = latin1(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildContractPdf(data: ContractPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pageSize: [number, number] = [595.28, 841.89];
  let page = doc.addPage(pageSize);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  let y = 790;

  const draw = (text: string, size: number, useBold = false) => {
    for (const line of wrap(text, size > 16 ? 42 : 88)) {
      if (y < 70) {
        page = doc.addPage(pageSize);
        y = 790;
      }
      page.drawText(line, {
        x: 56,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.12, 0.12, 0.11),
      });
      y -= size + 6;
    }
  };

  draw("Anima Cantus", 22, true);
  draw("Contrato de apresentação musical", 16, true);
  y -= 8;
  draw(`Contratante: ${data.legalName}`, 12);
  draw(`CPF/CNPJ: ${data.documentId}`, 12);
  draw(`E-mail: ${data.email}`, 12);
  draw(`Telefone: ${data.phone}`, 12);
  draw(`Endereço: ${data.address}`, 12);
  draw(`Data da cerimônia: ${data.weddingDate}`, 12);
  draw(`Horário: ${data.weddingTime ?? "a combinar"}`, 12);
  draw(`Local: ${data.venue}`, 12);
  if (data.formation) draw(`Formação: ${data.formation}`, 12);
  y -= 8;
  draw("Serviços contratados", 14, true);
  for (const item of data.items) draw(`- ${item.name}: ${item.priceLabel}`, 12);
  y -= 6;
  draw(`Valor do contrato: ${data.totalLabel}`, 13, true);
  draw(`Valor por extenso: ${data.totalInWords}`, 12);
  draw(`Pagamento: ${data.paymentTerms}`, 12);
  y -= 8;
  draw(
    "O contratante declara ter conferido os dados, os serviços e o valor deste instrumento. A assinatura eletrônica é realizada fora da plataforma, no gov.br, em conta prata ou ouro. O arquivo assinado deve ser enviado na área do casal para conferência da equipe Anima Cantus.",
    11,
  );
  y -= 8;
  draw(
    "Os valores impressos neste documento ficam preservados e não acompanham alterações futuras da tabela de preços.",
    11,
  );
  y -= 28;
  draw("Anima Cantus", 12, true);
  draw("Assinatura do contratante pelo gov.br, no arquivo enviado a parte.", 11);

  doc.setTitle("Contrato Anima Cantus");
  doc.setAuthor("Anima Cantus");
  return doc.save();
}
