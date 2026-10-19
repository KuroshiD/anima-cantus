import { describe, expect, it } from "vitest";
import { formatBRL, sumPrices, valorPorExtenso } from "./money";

describe("valorPorExtenso", () => {
  it("converte R$ 4.700,00 como no contrato de referência", () => {
    expect(valorPorExtenso(470_000)).toBe("Quatro mil e setecentos reais");
  });

  it("inclui centavos e trata real no singular", () => {
    expect(valorPorExtenso(0)).toBe("Zero real");
    expect(valorPorExtenso(1)).toBe("Um centavo");
    expect(valorPorExtenso(2)).toBe("Dois centavos");
    expect(valorPorExtenso(100)).toBe("Um real");
    expect(valorPorExtenso(200)).toBe("Dois reais");
    expect(valorPorExtenso(101)).toBe("Um real e um centavo");
    expect(valorPorExtenso(470_050)).toBe("Quatro mil e setecentos reais e cinquenta centavos");
  });

  it("aplica o e entre milhar e centena redonda", () => {
    expect(valorPorExtenso(100_000)).toBe("Mil reais");
    expect(valorPorExtenso(100_100)).toBe("Mil e um reais");
    expect(valorPorExtenso(110_000)).toBe("Mil e cem reais");
    expect(valorPorExtenso(111_100)).toBe("Mil cento e onze reais");
    expect(valorPorExtenso(100_000_000)).toBe("Um milhão de reais");
    expect(valorPorExtenso(200_000_000)).toBe("Dois milhões de reais");
    expect(valorPorExtenso(200_000_100)).toBe("Dois milhões e um reais");
  });

  it("recusa valor fracionário ou negativo", () => {
    expect(() => valorPorExtenso(-1)).toThrow();
    expect(() => valorPorExtenso(1.5)).toThrow();
  });
});

describe("cálculo do contrato", () => {
  it("soma os itens sem aceitar total digitado", () => {
    expect(sumPrices([350_000, 40_000, 80_000])).toBe(470_000);
    expect(formatBRL(470_000)).toMatch(/4\.700,00/);
    expect(() => sumPrices([1000], 2000)).toThrow();
  });
});
