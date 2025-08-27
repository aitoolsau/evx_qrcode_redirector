import { okJson, unauthorized } from "../lib/http";
import { bytesToB64url } from "../lib/base64";
import { pbkdf2Hash } from "../lib/crypto";
import { Env } from "../env";
import { requireAuth, verifyPassword } from "../services/auth";
import { bumpSessionVersion } from "../services/kv";

export async function handlePasswordGet(request: Request, env: Env): Promise<Response> {
  if (!(await requireAuth(request, env))) return unauthorized();
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
    if (!(await requireAuth(request, env))) return unauthorized();
    const body = await request.json().catch(()=>({}));
    const current = String((body as any).current || '');
    const next = String((body as any).next || '');
    if (next.length < 8) return okJson({ error: 'weak_password' }, { status: 400 });
    // If there is no stored hash yet, allow initializing a password even if current is blank or incorrect.
    const existingRecord = await env.MAPPINGS.get('CONFIG:ADMIN_PW');
    if (existingRecord) {
      const ok = await verifyPassword(env, current);
      if (!ok) return okJson({ error: 'bad_current' }, { status: 403 });
    } else {
      // Optional: if an ADMIN_PASSWORD env var exists and current was provided but wrong, we could enforce; for usability we skip.
    }
    const salt = new Uint8Array(16); crypto.getRandomValues(salt);
    const iterations = 100_000;
    const hash = await pbkdf2Hash(next, salt, iterations);
    const rec = { iterations, salt: bytesToB64url(salt), hash: bytesToB64url(hash), updatedAt: new Date().toISOString() };
    await env.MAPPINGS.put('CONFIG:ADMIN_PW', JSON.stringify(rec));
    await bumpSessionVersion(env); // force re-login everywhere
    const after = await env.MAPPINGS.get('CONFIG:ADMIN_PW');
    return okJson({ ok: true, visible: Boolean(after), initialized: !existingRecord });
  } catch (e: any) {
    const msg = e && (e.message || String(e));
    return okJson({ error: 'internal_error', message: msg }, { status: 500 });
  }
}
