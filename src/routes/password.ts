import { okJson, unauthorized } from "../lib/http";
import { bytesToB64url } from "../lib/base64";
import { pbkdf2Hash } from "../lib/crypto";
import { Env } from "../env";
import { requireAuth, verifyPassword, issueSession, validateSessionDetailed } from "../services/auth";
import { bumpSessionVersion } from "../services/kv";

export async function handlePasswordGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const debug = url.searchParams.get('debug') === '1';
  if (debug) {
    const cookie = request.headers.get('cookie') || '';
    const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (!m) return okJson({ error: 'unauthorized', reason: 'no_cookie' }, { status: 401 });
    const token = decodeURIComponent(m[1]);
    const detail = await validateSessionDetailed(env, token);
    if (!detail.ok) return okJson({ error: 'unauthorized', reason: detail.reason }, { status: 401 });
  } else if (!(await requireAuth(request, env))) {
    return unauthorized();
  }
  const rec = await env.MAPPINGS.get('CONFIG:ADMIN_PW');
  if (!rec) return okJson({ hasRecord: false });
  try {
    const cfg = JSON.parse(rec);
    return okJson({ hasRecord: true, updatedAt: cfg.updatedAt || null, iterations: cfg.iterations || null });
  } catch {
    return okJson({ hasRecord: true, parseError: true });
  }
}

export async function handlePasswordPost(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get('debug') === '1';
    let staleSession = false;
    if (debug) {
      const cookie = request.headers.get('cookie') || '';
      const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
      if (!m) return okJson({ error: 'unauthorized', reason: 'no_cookie' }, { status: 401 });
      const token = decodeURIComponent(m[1]);
      const detail = await validateSessionDetailed(env, token);
      if (!detail.ok) {
        if (detail.reason === 'session_version_mismatch') {
          staleSession = true; // allow password rotation with stale session
        } else {
          return okJson({ error: 'unauthorized', reason: detail.reason }, { status: 401 });
        }
      }
    } else {
      // Non-debug path: fall back to regular auth; if it fails try to detect mismatch to allow flow
      if (!(await requireAuth(request, env))) {
        const cookie = request.headers.get('cookie') || '';
        const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
        if (!m) return unauthorized();
        const token = decodeURIComponent(m[1]);
        const detail = await validateSessionDetailed(env, token);
        if (detail.ok) {
          // Should not happen (requireAuth said false); safe fail
          return unauthorized();
        }
        if (detail.reason === 'session_version_mismatch') {
          staleSession = true; // proceed
        } else {
          return unauthorized();
        }
      }
    }
    const body = await request.json().catch(()=>({}));
    const current = String((body as any).current || '');
    const next = String((body as any).next || '');
    if (next.length < 8) return okJson({ error: 'weak_password' }, { status: 400 });
  const ok = await verifyPassword(env, current);
  if (!ok) return okJson({ error: 'bad_current', message: debug ? 'current password mismatch' : undefined }, { status: 403 });
    const salt = new Uint8Array(16); crypto.getRandomValues(salt);
    const iterations = 100_000;
    const hash = await pbkdf2Hash(next, salt, iterations);
    const rec = { iterations, salt: bytesToB64url(salt), hash: bytesToB64url(hash), updatedAt: new Date().toISOString() };
    await env.MAPPINGS.put('CONFIG:ADMIN_PW', JSON.stringify(rec));
  await bumpSessionVersion(env); // invalidate old sessions
  // Immediately issue a fresh session token so current user stays logged in
  const newToken = await issueSession(env, env.ADMIN_USERNAME || 'admin');
  const headers = new Headers({ "Set-Cookie": `admin_session=${newToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` });
  const after = await env.MAPPINGS.get('CONFIG:ADMIN_PW');
  return okJson({ ok: true, visible: Boolean(after), sessionRefreshed: true, staleSession }, { headers });
  } catch (e: any) {
    const msg = e && (e.message || String(e));
    return okJson({ error: 'internal_error', message: msg }, { status: 500 });
  }
}
