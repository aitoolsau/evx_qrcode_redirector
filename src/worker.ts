import { okJson, unauthorized } from "./lib/http";
import { Env } from "./env";
import { handleAdmin } from "./routes/admin";
import { handleLoginForm, handleApiLoginJson, handleApiMe, handleApiLogoutPost, handleLogoutGet } from "./routes/auth";
import { handlePasswordGet, handlePasswordPost } from "./routes/password";
import { handleMappings } from "./routes/mappings";
import { handleDebugConfig } from "./routes/debug";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

    // Only host cpr.evx.tech
    if (url.hostname !== "cpr.evx.tech") {
      return new Response("Not found", { status: 404 });
    }

    // Admin UI & APIs
    if (url.pathname === "/admin") {
      return handleAdmin();
    }

    // Auth-related endpoints
    if (url.pathname === "/login" && request.method === "POST") {
      return handleLoginForm(request, env as any, url);
    }
    if (url.pathname === "/api/me") {
      return handleApiMe(request, env as any, url);
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      return handleApiLoginJson(request, env as any);
    }
    if (url.pathname === "/api/password" && request.method === "GET") {
      return handlePasswordGet(request, env as any);
    }
    if (url.pathname === "/api/password" && request.method === "POST") {
      return handlePasswordPost(request, env as any);
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      return handleApiLogoutPost();
    }

    // GET /logout helper for client redirects
    if (url.pathname === "/logout" && request.method === "GET") {
      return handleLogoutGet();
    }

    // Authenticated debug to check CONFIG state
    if (url.pathname === "/api/debug/config" && request.method === "GET") {
      return handleDebugConfig(request, env as any);
    }

    // Mappings CRUD (auth required)
    if (url.pathname.startsWith("/api/mappings")) {
      return handleMappings(request, env as any, url);
    }

    // Prevent redirect loop: do not redirect /public/cs/qr, or if query already includes identifiers
    if (
      url.pathname === "/public/cs/qr" ||
      url.searchParams.has("evseid") ||
      url.searchParams.has("revseid")
    ) {
      return new Response("OK", { status: 200 });
    }

    // Match /public/cs/{CHARGERID} with optional trailing slash, but exclude 'qr' as a chargerID
    const m = url.pathname.match(/^\/public\/cs\/([A-Za-z0-9]+)\/?$/);
    if (!m || m[1].toLowerCase() === "qr") {
      return new Response("Not found", { status: 404 });
    }

    const chargerId = m[1];

    // Prefer explicit mapping from KV; fall back to computed URL format
    let target = await env.MAPPINGS.get(chargerId);
    if (!target) {
      const cc = (env.COUNTRY_CODE || "AU").toUpperCase();
      const dest = new URL("https://cpr.evx.tech/public/cs/qr");
      dest.searchParams.set("evseid", `${cc}*EVX*${chargerId}`);
      target = dest.toString();
    }

      return Response.redirect(target, 302);
    } catch (err: any) {
      try { console.error('Unhandled worker error:', err && (err.stack || err.message || String(err))); } catch {}
      const msg = (err && (err.message || String(err))) || 'internal_error';
      return okJson({ error: 'internal_error', message: msg }, { status: 500 });
    }
  },
};
