import { okJson, unauthorized, html } from "../lib/http";
import { stringFromB64url } from "../lib/base64";
import { hmacVerify } from "../lib/crypto";
import { Env } from "../env";
import { issueSession, logoutHeaders } from "../services/auth";
import { getSessionVersion } from "../services/kv";

export async function handleLoginForm(request: Request, env: Env, url: URL): Promise<Response> {
  // Expect form-urlencoded; also support JSON
  const ct = request.headers.get('content-type') || '';
  let user = '', pass = '';
  if (ct.includes('application/x-www-form-urlencoded')){
    const form = await request.formData();
    user = String(form.get('user') || '');
    pass = String(form.get('pass') || '');
  } else if (ct.includes('application/json')){
    const body = await request.json().catch(()=>({}));
    user = String((body as any).user || '');
    pass = String((body as any).pass || '');
  }
  const uOk = (env.ADMIN_USERNAME || 'admin') === user;
  const mod = await import("../services/auth");
  const pOk = await mod.verifyPassword(env, pass);
  if (!uOk || !pOk) return html('<script>location.href="/urlmapping?login=failed"</script>', { status: 401 });
  const token = await issueSession(env, user);
  const headers = new Headers({ "Set-Cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` });
  const rd = url.searchParams.get('redirect_to') || '/urlmapping';
  headers.set('Location', rd);
  return new Response(null, { status: 303, headers });
}

export async function handleApiLoginJson(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const user = String((body as any).user || "");
    const pass = String((body as any).pass || "");
    const uOk = (env.ADMIN_USERNAME || "admin") === String(user || "");
    const mod = await import("../services/auth");
    const pOk = await mod.verifyPassword(env, String(pass || ""));
    if (!uOk || !pOk) return unauthorized();
    const token = await issueSession(env, user);
    const headers = new Headers({ "Set-Cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` });
    return okJson({ ok: true }, { headers });
  } catch {
    return okJson({ error: "bad_request" }, { status: 400 });
  }
}

export async function handleApiMe(request: Request, env: Env, url: URL): Promise<Response> {
  const debug = url.searchParams.get('debug') === '1';
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return debug ? okJson({ error: 'unauthorized', reason: 'no_cookie' }, { status: 401 }) : unauthorized();
  const token = decodeURIComponent(m[1]);
  const parts = token.split('.');
  if (parts.length !== 2) return debug ? okJson({ error: 'unauthorized', reason: 'bad_token' }, { status: 401 }) : unauthorized();
  const [payloadB64, sig] = parts;
  const secret = (env as any).SESSION_SECRET || env.ADMIN_PASSWORD || '';
  if (!secret) return debug ? okJson({ error: 'unauthorized', reason: 'no_secret' }, { status: 401 }) : unauthorized();
  if (!(await hmacVerify(secret, payloadB64, sig))) return debug ? okJson({ error: 'unauthorized', reason: 'bad_sig' }, { status: 401 }) : unauthorized();
  try {
    const payload = JSON.parse(stringFromB64url(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > Number(payload.exp)) return debug ? okJson({ error: 'unauthorized', reason: 'expired' }, { status: 401 }) : unauthorized();
    const ver = await getSessionVersion(env);
    if (payload.v && Number(payload.v) !== ver) return debug ? okJson({ error: 'unauthorized', reason: 'session_version' }, { status: 401 }) : unauthorized();
    return okJson({ ok: true });
  } catch {
    return debug ? okJson({ error: 'unauthorized', reason: 'bad_payload' }, { status: 401 }) : unauthorized();
  }
}

export async function handleApiLogoutPost(): Promise<Response> {
  const headers = await logoutHeaders();
  return okJson({ ok: true }, { headers });
}

export async function handleLogoutGet(): Promise<Response> {
  const headers = await logoutHeaders();
  headers.set('Location', '/urlmapping');
  return new Response(null, { status: 303, headers });
}
