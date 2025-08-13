export interface Env {
  COUNTRY_CODE?: string; // default AU
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Only host cpr.evx.tech
    if (url.hostname !== "cpr.evx.tech") {
      return new Response("Not found", { status: 404 });
    }

    // Prevent redirect loop: do not redirect /public/cs/qr or if 'evseid' is present in the query string
    if (url.pathname === "/public/cs/qr" || url.searchParams.has("evseid")) {
      return new Response("OK", { status: 200 });
    }

    // Match /public/cs/{CHARGERID} with optional trailing slash
    const m = url.pathname.match(/^\/public\/cs\/([A-Za-z0-9]+)\/?$/);
    if (!m) {
      return new Response("Not found", { status: 404 });
    }

    const chargerId = m[1];
    const cc = (env.COUNTRY_CODE || "AU").toUpperCase();

  const dest = new URL("https://cp.evx.tech/public/cs/qr");
  dest.searchParams.set("evseid", `${cc}*EVX*${chargerId}`);

    // 302 for QR flows
    return Response.redirect(dest.toString(), 302);
  },
} satisfies ExportedHandler<Env>;
