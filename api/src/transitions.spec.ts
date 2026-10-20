import { contractTransition, journeyAfterContractDecision } from "./transitions";

describe("transições do contrato", () => {
  it("só avança de em andamento para aguardando validação", () => {
    expect(contractTransition("EM_ANDAMENTO", "AGUARDANDO_VALIDACAO")).toEqual({ ok: true });
    expect(contractTransition("CONCLUIDA", "EM_ANDAMENTO")).toEqual({
      ok: false,
      reason: "INVALID_CONTRACT_TRANSITION",
    });
    expect(contractTransition("EM_ANDAMENTO", "CONCLUIDA")).toEqual({
      ok: false,
      reason: "INVALID_CONTRACT_TRANSITION",
    });
  });

  it("recusa volta para em andamento e aceite libera o repertório", () => {
    expect(journeyAfterContractDecision(false)).toEqual({ contract: "EM_ANDAMENTO" });
    expect(journeyAfterContractDecision(true)).toEqual({
      contract: "CONCLUIDA",
      repertorio: { from: "PENDENTE", to: "EM_ANDAMENTO" },
    });
  });
});
