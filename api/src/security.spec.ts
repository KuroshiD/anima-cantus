import { cookieOptions } from "./security";

describe("cookieOptions", () => {
  it("omits Max-Age for a browser-session cookie", () => {
    expect(cookieOptions()).not.toHaveProperty("maxAge");
  });

  it("sets Max-Age for a persistent cookie", () => {
    expect(cookieOptions(60)).toHaveProperty("maxAge", 60_000);
  });
});
