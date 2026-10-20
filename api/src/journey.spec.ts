import { describeStep, nextJourneyAction } from "./journey";

describe("textos da jornada", () => {
  it("descreve cada etapa pelo estado atual", () => {
    expect(describeStep("CADASTRO", "CONCLUIDA", "2026-11-20")).toBe("Perfil criado");
    expect(describeStep("CADASTRO", "EM_ANDAMENTO", "2026-11-20")).toBe("Complete seu cadastro");
    expect(describeStep("CONTRATO", "EM_ANDAMENTO", "2026-11-20")).toBe("Aguardando sua assinatura");
    expect(describeStep("CONTRATO", "AGUARDANDO_VALIDACAO", "2026-11-20")).toBe("A equipe está conferindo o documento");
    expect(describeStep("CONTRATO", "CONCLUIDA", "2026-11-20")).toBe("Contrato validado");
    expect(describeStep("CONTRATO", "PENDENTE", "2026-11-20")).toBe("Uma lembrança especial");
    expect(describeStep("REPERTORIO", "PENDENTE", "2026-11-20")).toBe("Liberado após o contrato");
    expect(describeStep("REPERTORIO", "EM_ANDAMENTO", "2026-11-20")).toBe("Escolha as músicas da cerimônia");
    expect(describeStep("REPERTORIO", "CONCLUIDA", "2026-11-20")).toBe("Repertório definido");
    expect(describeStep("CASAMENTO", "EM_ANDAMENTO", "2026-11-20")).toBe("20/11/2026");
    expect(describeStep("POS_EVENTO", "CONCLUIDA", "2026-11-20")).toBe("Mensagem de um ano enviada");
    expect(describeStep("POS_EVENTO", "PENDENTE", "2026-11-20")).toBe("Uma lembrança especial");
  });

  it("aponta a próxima ação da etapa aberta", () => {
    expect(nextJourneyAction({ current: undefined, weddingDate: "2026-11-20", hasSnapshot: false })).toBeNull();
    expect(
      nextJourneyAction({
        current: { key: "CONTRATO", status: "EM_ANDAMENTO" },
        weddingDate: "2026-11-20",
        hasSnapshot: false,
      }),
    ).toEqual({
      title: "Monte o contrato",
      description: "Preencha os dados, escolha os serviços e gere o PDF.",
      href: "/contrato",
    });
    expect(
      nextJourneyAction({
        current: { key: "CONTRATO", status: "EM_ANDAMENTO" },
        weddingDate: "2026-11-20",
        hasSnapshot: true,
      })?.title,
    ).toBe("Assine o contrato");
    expect(
      nextJourneyAction({
        current: { key: "CONTRATO", status: "AGUARDANDO_VALIDACAO" },
        weddingDate: "2026-11-20",
        hasSnapshot: true,
      })?.title,
    ).toBe("Contrato em conferência");
    expect(
      nextJourneyAction({
        current: { key: "REPERTORIO", status: "EM_ANDAMENTO" },
        weddingDate: "2026-11-20",
        hasSnapshot: true,
      })?.href,
    ).toBe("/repertorio");
    expect(
      nextJourneyAction({
        current: { key: "CASAMENTO", status: "EM_ANDAMENTO" },
        weddingDate: "2026-11-20",
        hasSnapshot: true,
      })?.description,
    ).toBe("A cerimônia está marcada para 20/11/2026.");
    expect(
      nextJourneyAction({
        current: { key: "POS_EVENTO", status: "EM_ANDAMENTO" },
        weddingDate: "2026-11-20",
        hasSnapshot: true,
      })?.title,
    ).toBe("Depois do casamento");
  });
});
