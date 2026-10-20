import { cookieOptions, requireCoupleId } from "./security";

describe("cookieOptions", () => {
  it("omits Max-Age for a browser-session cookie", () => {
    expect(cookieOptions()).not.toHaveProperty("maxAge");
  });

  it("sets Max-Age for a persistent cookie", () => {
    expect(cookieOptions(60)).toHaveProperty("maxAge", 60_000);
  });
});

describe("requireCoupleId", () => {
  const couple = {
    userId: "user-1",
    role: "COUPLE" as const,
    coupleId: "couple-1",
    email: "casal@example.com",
    csrfToken: "token",
  };

  it("devolve o casal da sessão e recusa quem não tem vínculo", () => {
    expect(requireCoupleId({ user: couple })).toBe("couple-1");
    expect(() => requireCoupleId({})).toThrow("Faça login para continuar.");
    expect(() => requireCoupleId({ user: { ...couple, coupleId: null } })).toThrow("Esta área é do casal.");
  });
});
