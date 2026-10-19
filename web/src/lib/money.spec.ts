import { formatBRL } from "@anima/shared";
import { describe, expect, it } from "vitest";

describe("formato de moeda na interface", () => {
  it("mostra o total do contrato de referência", () => {
    expect(formatBRL(470_000)).toContain("4.700,00");
  });
});
