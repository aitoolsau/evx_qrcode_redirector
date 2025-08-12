import { describe, it, expect } from "vitest";

const handle = async (url: string, cc = "AU") => {
  const mod = await import("../src/worker");
  const req = new Request(url);
  const res = await (mod.default as any).fetch(req, { COUNTRY_CODE: cc });
  return res;
};

describe("QR redirect", () => {
  it("redirects a valid legacy URL", async () => {
    const res = await handle("https://cpr.evx.tech/public/cs/20105B");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://cpr.evx.tech/public/cs/qr?evseid=AU*EVX*20105B"
    );
  });

  it("respects COUNTRY_CODE var", async () => {
    const res = await handle("https://cpr.evx.tech/public/cs/ABC123", "NZ");
    expect(res.headers.get("location")).toBe(
      "https://cpr.evx.tech/public/cs/qr?evseid=NZ*EVX*ABC123"
    );
  });

  it("404 on wrong host", async () => {
    const res = await handle("https://cp.evx.tech/public/cs/20105B");
    expect(res.status).toBe(404);
  });

  it("404 on non-matching path", async () => {
    const res = await handle("https://cpr.evx.tech/public/cs/");
    expect(res.status).toBe(404);
  });
});
