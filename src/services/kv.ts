import { Env } from "../env";

const CONFIG_PREFIX = "CONFIG:";

export async function getConfig(env: Env, key: string): Promise<string | null> {
  return env.MAPPINGS.get(key);
}

export async function setConfig(env: Env, key: string, value: string): Promise<void> {
  await env.MAPPINGS.put(key, value);
}

export async function getSessionVersion(env: Env): Promise<number> {
  const v = await env.MAPPINGS.get(`${CONFIG_PREFIX}SESSION_VERSION`);
  const n = Number(v || 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function bumpSessionVersion(env: Env): Promise<number> {
  const v = (await getSessionVersion(env)) + 1;
  await env.MAPPINGS.put(`${CONFIG_PREFIX}SESSION_VERSION`, String(v));
  return v;
}

export async function getMapping(env: Env, id: string): Promise<string | null> {
  return env.MAPPINGS.get(id);
}

export async function setMapping(env: Env, id: string, url: string): Promise<void> {
  await env.MAPPINGS.put(id, url);
}

export async function deleteMapping(env: Env, id: string): Promise<void> {
  await env.MAPPINGS.delete(id);
}

export async function listMappings(env: Env, prefix = "") {
  const list = await env.MAPPINGS.list({ prefix });
  const filtered = list.keys.filter((k: any) => !k.name.startsWith("SESS:") && !k.name.startsWith("CONFIG:"));
  return { keys: filtered };
}

// List all non-config/session mapping keys with pagination support
export async function listAllMappings(env: Env): Promise<Array<{ name: string }>> {
  const page = await env.MAPPINGS.list();
  return page.keys.filter((k: any) => !k.name.startsWith("SESS:") && !k.name.startsWith("CONFIG:"));
}

// Delete all non-config/session mapping keys
export async function wipeMappings(env: Env): Promise<void> {
  const page = await env.MAPPINGS.list();
  const toDelete = page.keys.filter(k => !k.name.startsWith("SESS:") && !k.name.startsWith("CONFIG:"));
  await Promise.all(toDelete.map(k => env.MAPPINGS.delete(k.name)));
}
