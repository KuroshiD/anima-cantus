import { ConflictException } from "@nestjs/common";
import { assertContractTransition, journeyAfterContractDecision } from "./transitions";

describe("transições do contrato", () => {
  it("só avança de em andamento para aguardando validação", () => {
    expect(() => assertContractTransition("EM_ANDAMENTO", "AGUARDANDO_VALIDACAO")).not.toThrow();
    expect(() => assertContractTransition("CONCLUIDA", "EM_ANDAMENTO")).toThrow(ConflictException);
    expect(() => assertContractTransition("EM_ANDAMENTO", "CONCLUIDA")).toThrow(ConflictException);
  });

  it("recusa volta para em andamento e aceite libera o repertório", () => {
    expect(journeyAfterContractDecision(false)).toEqual({ contract: "EM_ANDAMENTO" });
    expect(journeyAfterContractDecision(true)).toEqual({
      contract: "CONCLUIDA",
      repertorio: { from: "PENDENTE", to: "EM_ANDAMENTO" },
    });
  });
});
