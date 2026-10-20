import { describe, expect, it } from "vitest";
import { classifyRepertoireDeadline } from "./repertoire";

const base = {
  status: "EM_ANDAMENTO",
  filledCount: 2,
  momentCount: 6,
  windowEnd: "2026-10-21",
  leadDays: 7,
};

describe("prazo do repertório", () => {
  it("não sinaliza fora da janela, com etapa fechada ou repertório completo", () => {
    expect(classifyRepertoireDeadline({ ...base, today: "2026-10-13" })).toBe("none");
    expect(classifyRepertoireDeadline({ ...base, today: "2026-10-14", status: "PENDENTE" })).toBe("none");
    expect(classifyRepertoireDeadline({ ...base, today: "2026-10-14", filledCount: 6 })).toBe("none");
  });

  it("marca proximidade a partir do lead e atraso só depois do fim", () => {
    expect(classifyRepertoireDeadline({ ...base, today: "2026-10-14" })).toBe("approaching");
    expect(classifyRepertoireDeadline({ ...base, today: "2026-10-21" })).toBe("approaching");
    expect(classifyRepertoireDeadline({ ...base, today: "2026-10-22" })).toBe("overdue");
  });
});
