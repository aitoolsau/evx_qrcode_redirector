import { Env } from "../env";
import { hmacSign, hmacVerify, pbkdf2Hash } from "../lib/crypto";
import { b64urlFromString } from "../lib/base64";
import { getConfig, bumpSessionVersion, getSessionVersion } from "./kv";

const ADMIN_PW_KEY = "CONFIG:ADMIN_PW";

export async function verifyPassword(env: Env, pass: string): Promise<boolean> {
  const rec = await getConfig(env, ADMIN_PW_KEY);
  if (rec) {
    try {
      const cfg = JSON.parse(rec);
      const saltB64 = String(cfg.salt || "");
      const salt = new Uint8Array(atob(saltB64.replace(/-/g,'+').replace(/_/g,'/')).split('').map(c=>c.charCodeAt(0)));
      const it = Number(cfg.iterations || 100_000);
      const got = await pbkdf2Hash(pass, salt, it);
      const hashB64 = btoa(String.fromCharCode(...got)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
      return hashB64 === String(cfg.hash || "");
    } catch {
      return false;
    }
  }
  return (env.ADMIN_PASSWORD || '') === pass;
}

export async function issueSession(env: Env, user: string): Promise<string> {
  const iat = Math.floor(Date.now()/1000);
  const exp = iat + 3600;
  const v = await getSessionVersion(env);
  const payload = { u: user, iat, exp, v };
  const payloadB64 = b64urlFromString(JSON.stringify(payload));
  const sig = await hmacSign((env as any).SESSION_SECRET || env.ADMIN_PASSWORD || '', payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function validateSession(env: Env, token: string): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const secret = (env as any).SESSION_SECRET || env.ADMIN_PASSWORD || '';
  if (!secret) return false;
  if (!(await hmacVerify(secret, payloadB64, sig))) return false;
  try {
    const base = payloadB64.replace(/-/g,'+').replace(/_/g,'/');
    const pad = base + '==='.slice((base.length + 3) % 4);
    const bin = atob(pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > Number(payload.exp)) return false;
    const ver = await getSessionVersion(env);
    if (payload.v === undefined || Number(payload.v) !== ver) return false;
    return true;
  } catch {
    return false;
  }
}

export async function logoutHeaders(): Promise<Headers> {
  return new Headers({ "Set-Cookie": `admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` });
}

// Convenience guard used by route handlers
export async function requireAuth(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  return validateSession(env, token);
}
