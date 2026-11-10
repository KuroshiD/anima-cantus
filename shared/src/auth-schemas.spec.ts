import { describe, expect, it } from "vitest";
import { contractDraftSchema, isValidCpf, loginSchema, registerSchema } from "./schemas";

describe("auth schemas", () => {
  it("defaults to a browser-session cookie unless the user asks to stay connected", () => {
    const parsed = loginSchema.parse({ email: "casal@example.com", password: "password" });
    expect(parsed.rememberMe).toBe(false);
  });

  it("requires the accepted legal version when creating an account", () => {
    const registration = {
      partnerOne: "Marina",
      partnerTwo: "Rafael",
      email: "casal@example.com",
      password: "Casal1234",
      phone: "16999999999",
      weddingDate: "2027-05-12",
    };
    expect(registerSchema.safeParse(registration).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, termsVersion: "2026-10-19" }).success).toBe(true);
  });

  it("valida apenas CPFs com dígitos verificadores corretos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(contractDraftSchema.shape.documentId.safeParse("12.345.678/0001-99").success).toBe(false);
  });
});
