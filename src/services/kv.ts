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

export async function listMappings(env: Env, prefix = "", limit?: number, cursor?: string) {
  const options: any = { prefix };
  if (limit) options.limit = limit;
  if (cursor) options.cursor = cursor;
  
  const list = await env.MAPPINGS.list(options);
  const filtered = list.keys.filter((k: any) => !k.name.startsWith("SESS:") && !k.name.startsWith("CONFIG:"));
  
  return { 
    keys: filtered,
    list_complete: (list as any).list_complete,
    cursor: (list as any).cursor
  };
}

// Get total count of mappings with prefix
export async function getTotalMappingsCount(env: Env, prefix = ""): Promise<number> {
  let count = 0;
  let cursor: string | undefined = undefined;
  let hasMore = true;
  
  while (hasMore) {
    const options: any = { prefix, limit: 1000 }; // Use large batch for counting
    if (cursor) options.cursor = cursor;
    
    const list = await env.MAPPINGS.list(options);
    const filtered = list.keys.filter((k: any) => !k.name.startsWith("SESS:") && !k.name.startsWith("CONFIG:"));
    count += filtered.length;
    
    hasMore = !(list as any).list_complete;
    cursor = (list as any).cursor;
  }
  
  return count;
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

// Batch set multiple mappings for improved performance
export async function batchSetMappings(env: Env, mappings: Array<{ key: string; url: string }>): Promise<void> {
  // Process in chunks to avoid overwhelming KV with too many concurrent operations
  const BATCH_SIZE = 50; // Cloudflare KV can handle concurrent operations well
  
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const chunk = mappings.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(({ key, url }) => env.MAPPINGS.put(key, url)));
  }
}

// Batch get multiple mappings for improved export/backup performance
export async function batchGetMappings(env: Env, keys: Array<{ name: string }>): Promise<Array<{ key: string; url: string | null }>> {
  // Process in chunks to avoid overwhelming KV with too many concurrent operations
  const BATCH_SIZE = 100; // KV reads can handle larger batches than writes
  const results: Array<{ key: string; url: string | null }> = [];
  
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const chunk = keys.slice(i, i + BATCH_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (k) => ({
        key: k.name,
        url: await env.MAPPINGS.get(k.name)
      }))
    );
    results.push(...chunkResults);
  }
  
  return results;
}
