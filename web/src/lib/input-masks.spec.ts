import { describe, expect, it } from "vitest";
import { currencyToCents, formatCpf, formatCurrency, formatPhone } from "./input-masks";

describe("máscaras dos campos", () => {
  it("formata telefones com DDD e limita a quantidade de dígitos", () => {
    expect(formatPhone("16999990000")).toBe("(16) 99999-0000");
    expect(formatPhone("(16) 3333-0000")).toBe("(16) 3333-0000");
    expect(formatPhone("169999900001")).toBe("(16) 99999-0000");
  });

  it("formata apenas CPF", () => {
    expect(formatCpf("12345678901")).toBe("123.456.789-01");
    expect(formatCpf("12345678901234")).toBe("123.456.789-01");
  });

  it("formata moeda em reais e converte para centavos", () => {
    expect(formatCurrency("123456")).toBe("1.234,56");
    expect(currencyToCents("1.234,56")).toBe(123456);
    expect(formatCurrency("")).toBe("");
  });
});
