import { describe, expect, it } from "vitest";
import { anniversaryIso, asDate, daysUntil, isIsoOnOrAfter, isoDate, localIsoDate, repertoireWindow } from "./dates";
import { budgetWhatsAppText, whatsAppLink } from "./whatsapp";

describe("janela do repertório", () => {
  it("calcula 35 a 30 dias antes de 20/11/2026", () => {
    expect(repertoireWindow("2026-11-20")).toEqual({
      start: "2026-10-16",
      end: "2026-10-21",
    });
  });

  it("agenda a mensagem um ano depois e evita 29 de fevereiro inválido", () => {
    expect(anniversaryIso("2026-11-20")).toBe("2027-11-20");
    expect(anniversaryIso("2028-02-29")).toBe("2029-02-28");
  });

  it("conta os dias até a cerimônia sem ficar negativo", () => {
    expect(daysUntil("2026-10-18", new Date(2026, 9, 18))).toBe(0);
    expect(daysUntil("2026-10-17", new Date(2026, 9, 18))).toBe(0);
    expect(daysUntil("2026-11-20", new Date(2026, 9, 18))).toBe(33);
  });

  it("grava e lê a data civil em meia-noite UTC", () => {
    expect(asDate("2026-11-20T15:00:00.000Z").toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(isoDate(asDate("2026-11-20"))).toBe("2026-11-20");
  });

  it("compara a data com o calendário local informado", () => {
    expect(localIsoDate(new Date(2026, 9, 20, 23, 30))).toBe("2026-10-20");
    expect(isIsoOnOrAfter("2026-10-20", "2026-10-20")).toBe(true);
    expect(isIsoOnOrAfter("2026-10-19", "2026-10-20")).toBe(false);
  });
});

describe("wa.me", () => {
  it("monta o link com a mensagem estruturada do orçamento", () => {
    const text = budgetWhatsAppText({
      name: "Marina",
      phone: "(16) 99999-0000",
      weddingDate: "2026-11-20",
      venue: "Igreja",
      hasPlanner: true,
      source: "Instagram",
    });
    const link = whatsAppLink("16999990000", text);
    expect(link.startsWith("https://wa.me/5516999990000?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Nome: Marina");
    expect(decodeURIComponent(link)).toContain("20/11/2026");
  });
});
