import { okJson, unauthorized, html } from "./lib/http";
import { Env } from "./env";
import { handleAdmin } from "./routes/admin";
import { handleLoginForm, handleApiLoginJson, handleApiMe, handleApiLogoutPost, handleLogoutGet } from "./routes/auth";
import { handlePasswordGet, handlePasswordPost } from "./routes/password";
import { handleMappings } from "./routes/mappings";
import { handleDebugConfig } from "./routes/debug";
import { handleHealth } from "./routes/health";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

    // Allow public redirect endpoints on both cpr.evx.tech and cp.evx.tech.
    // Admin & API (auth) remain only on cpr.evx.tech.
    const isCpr = url.hostname === "cpr.evx.tech";
    const isCp = url.hostname === "cp.evx.tech";
    if (!isCpr && !isCp) {
      return new Response("Not found", { status: 404 });
    }

    // Admin UI & APIs
    if (isCpr && url.pathname === "/admin") {
      return handleAdmin();
    }

    // Auth-related endpoints
  if (isCpr && url.pathname === "/login" && request.method === "POST") {
      return handleLoginForm(request, env as any, url);
    }
  if (isCpr && url.pathname === "/api/me") {
      return handleApiMe(request, env as any, url);
    }
  if (isCpr && url.pathname === "/api/login" && request.method === "POST") {
      return handleApiLoginJson(request, env as any);
    }
  if (isCpr && url.pathname === "/api/password" && request.method === "GET") {
      return handlePasswordGet(request, env as any);
    }
  if (isCpr && url.pathname === "/api/password" && request.method === "POST") {
      return handlePasswordPost(request, env as any);
    }
  if (isCpr && url.pathname === "/api/logout" && request.method === "POST") {
      return handleApiLogoutPost();
    }

    // GET /logout helper for client redirects
  if (isCpr && url.pathname === "/logout" && request.method === "GET") {
      return handleLogoutGet();
    }

    // Authenticated debug to check CONFIG state
  if (isCpr && url.pathname === "/api/debug/config" && request.method === "GET") {
      return handleDebugConfig(request, env as any);
    }

    // Health endpoint (exposed only on cpr host for admin use)
    if (isCpr && url.pathname === "/api/health" && request.method === "GET") {
      return handleHealth(env as any);
    }

    // Mappings CRUD (auth required)
  if (isCpr && url.pathname.startsWith("/api/mappings")) {
      return handleMappings(request, env as any, url);
    }

    // Bypass /public/cs/qr (final app page) or when already has identifiers.
    // For cp.evx.tech we want to escape the Worker and reach the upstream AMPECO app, so we redirect to ORIGIN_HOST.
    if (
      url.pathname === "/public/cs/qr" ||
      url.searchParams.has("evseid") ||
      url.searchParams.has("revseid")
    ) {
      if (isCp) {
        const originHost = env.ORIGIN_HOST || 'evx.au.charge.ampeco.tech';
        const target = `https://${originHost}${url.pathname}${url.search}`;
        return Response.redirect(target, 302);
      }
      // On cpr host keep simple OK to avoid loops / unnecessary work
      return new Response("OK", { status: 200 });
    }

    // Match /public/cs/{CHARGERID} with optional trailing slash, but exclude 'qr' as a chargerID
    const m = url.pathname.match(/^\/public\/cs\/([A-Za-z0-9]+)\/?$/);
    if (!m || m[1].toLowerCase() === "qr") {
      return new Response("Not found", { status: 404 });
    }

  const chargerId = m[1].toUpperCase();

    // Prefer explicit mapping from KV; if missing, show message then forward to origin URL
    const existing = await env.MAPPINGS.get(chargerId);
    if (!existing) {
      const originHost = env.ORIGIN_HOST || 'evx.au.charge.ampeco.tech';
      const originUrl = `https://${originHost}/public/cs/${chargerId}`;
      const body = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3;url=${originUrl}"><title>Not found</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; padding:2rem;">
<p>Charge ID not found in mapping file. Forward to origin URL</p>
<p><a href="${originUrl}">Continue to ${originUrl}</a> (in 3 seconds)</p>
</body></html>`;
      const resp = html(body, { status: 404 });
      resp.headers.set('X-EVX-Mapping', 'miss');
      resp.headers.set('X-EVX-Key', chargerId);
      resp.headers.set('X-EVX-Host', url.hostname);
      return resp;
    }

      const redirectResp = Response.redirect(existing, 302);
      redirectResp.headers.set('X-EVX-Mapping', 'hit');
      redirectResp.headers.set('X-EVX-Key', chargerId);
      redirectResp.headers.set('X-EVX-Host', url.hostname);
      return redirectResp;
    } catch (err: any) {
      try { console.error('Unhandled worker error:', err && (err.stack || err.message || String(err))); } catch {}
      const msg = (err && (err.message || String(err))) || 'internal_error';
      return okJson({ error: 'internal_error', message: msg }, { status: 500 });
    }
  },
};
