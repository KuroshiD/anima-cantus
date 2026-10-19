import { buildContractPdf } from "./pdf";

describe("PDF do contrato", () => {
  it("gera um PDF com os campos da contratação", async () => {
    const bytes = await buildContractPdf({
      legalName: "Marina e Rafael",
      documentId: "12345678909",
      email: "marina.rafael@animacantus.local",
      phone: "16999990000",
      address: "Rua das Flores, 100",
      weddingDate: "20/11/2026",
      weddingTime: "16:00",
      venue: "Capela",
      formation: "Voz, piano e violino",
      paymentTerms: "50% na assinatura e 50% até a cerimônia",
      totalInWords: "Quatro mil e setecentos reais",
      totalLabel: "R$ 4.700,00",
      items: [
        { name: "Pacote completo", priceLabel: "R$ 3.500,00" },
        { name: "Instrumentista adicional", priceLabel: "R$ 400,00" },
        { name: "Recepção", priceLabel: "R$ 800,00" },
      ],
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
    expect(doc.getTitle()).toBe("Contrato Anima Cantus");
  });
});
