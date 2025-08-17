import { okJson, unauthorized } from "../lib/http";
import { Env } from "../env";
import { requireAuth } from "../services/auth";

export async function handleDebugConfig(request: Request, env: Env): Promise<Response> {
  if (!(await requireAuth(request, env))) return unauthorized();
  const pw = await env.MAPPINGS.get('CONFIG:ADMIN_PW').catch(()=>null);
  const sv = await env.MAPPINGS.get('CONFIG:SESSION_VERSION').catch(()=>null);
  let meta: any = { hasPw: Boolean(pw), sessionVersion: sv ? Number(sv) : null };
  if (pw) {
    try {
      const cfg = JSON.parse(pw);
      meta.updatedAt = cfg.updatedAt || null;
      meta.iterations = cfg.iterations || null;
      meta.hashLen = (cfg.hash && String(cfg.hash).length) || null;
    } catch { meta.parseError = true; }
  }
  return okJson(meta);
}
