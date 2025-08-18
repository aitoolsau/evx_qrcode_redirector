import { okJson, unauthorized } from "../lib/http";
import { Env } from "../env";
import { requireAuth } from "../services/auth";
import { listMappings, getMapping, setMapping, deleteMapping, listAllMappings, wipeMappings } from "../services/kv";

export async function handleMappings(request: Request, env: Env, url: URL): Promise<Response> {
  if (!(await requireAuth(request, env))) return unauthorized();
  // normalize id to uppercase to avoid duplicate casing
  const canonical = (id: string) => id.trim().toUpperCase();
  if (request.method === "GET") {
    const id = url.pathname.replace("/api/mappings", "").slice(1);
    if (id) {
      const val = await getMapping(env, canonical(id));
      return val ? okJson({ key: id, url: val }) : okJson({ error: "not_found" }, { status: 404 });
    }
    // CSV export if format=csv
    if ((url.searchParams.get("format") || "").toLowerCase() === "csv") {
      const keys = await listAllMappings(env);
      let csv = "key,url\n";
      for (const k of keys) {
        const v = await getMapping(env, k.name);
        const keyEsc = '"' + k.name.replace(/"/g, '""') + '"';
        const valEsc = v ? '"' + v.replace(/"/g, '""') + '"' : '""';
        csv += `${keyEsc},${valEsc}\n`;
      }
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename=mappings-export.csv`
        }
      });
    }
    const prefix = url.searchParams.get("prefix") || "";
    const list = await listMappings(env, prefix.toUpperCase());
    return okJson(list);
  }
  if (request.method === "PUT") {
    const id = url.pathname.replace("/api/mappings", "").slice(1);
    if (!id) return okJson({ error: "bad_key" }, { status: 400 });
    const body = await request.json().catch(() => ({ url: "" }));
    const target = (body as any).url as string;
    try {
      const u = new URL(String(target || ""));
      if (u.protocol !== "https:") throw new Error("https_required");
    } catch (e) {
      return okJson({ error: "invalid_url" }, { status: 400 });
    }
    const key = canonical(id);
    if (id !== key) {
      // remove any existing variant to prevent duplicates by case
      await deleteMapping(env, id);
    }
    await setMapping(env, key, target);
    return okJson({ ok: true, key, url: target });
  }
  if (request.method === "DELETE") {
    const id = url.pathname.replace("/api/mappings", "").slice(1);
    if (!id) return okJson({ error: "bad_key" }, { status: 400 });
    const key = canonical(id);
    await deleteMapping(env, key);
    if (id !== key) await deleteMapping(env, id);
    return okJson({ ok: true });
  }
  if (request.method === "POST" && url.searchParams.get("import") === "csv") {
    // Import CSV: delete all existing mappings, then write new ones
    const text = await request.text();
    // Parse CSV: header key,url expected
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return okJson({ error: "empty_csv" }, { status: 400 });
    const header = lines.shift()!;
    const cols = header.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
    const kIdx = cols.findIndex(c => c.toLowerCase() === 'key');
    const vIdx = cols.findIndex(c => c.toLowerCase() === 'url');
    if (kIdx === -1 || vIdx === -1) return okJson({ error: "bad_header" }, { status: 400 });
    // wipe first
    await wipeMappings(env);
    let count = 0;
    for (const line of lines) {
      // naive CSV parse for quoted fields
      const parts: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i=0;i<line.length;i++){
        const ch = line[i];
        if (inQ) {
          if (ch === '"') {
            if (i+1 < line.length && line[i+1] === '"') { cur += '"'; i++; }
            else { inQ = false; }
          } else cur += ch;
        } else {
          if (ch === '"') inQ = true;
          else if (ch === ',') { parts.push(cur); cur = ''; }
          else cur += ch;
        }
      }
      parts.push(cur);
      const rawKey = (parts[kIdx] || '').trim();
      const rawUrl = (parts[vIdx] || '').trim();
      if (!rawKey) continue;
      try {
        const u = new URL(rawUrl);
        if (u.protocol !== 'https:') throw new Error();
      } catch { continue; }
      await setMapping(env, canonical(rawKey), rawUrl);
      count++;
    }
    return okJson({ ok: true, imported: count });
  }
  return okJson({ error: "method_not_allowed" }, { status: 405 });
}
