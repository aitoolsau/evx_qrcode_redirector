import { okJson, unauthorized } from "../lib/http";
import { Env } from "../env";
import { requireAuth } from "../services/auth";
import { listMappings, getMapping, setMapping, deleteMapping } from "../services/kv";

export async function handleMappings(request: Request, env: Env, url: URL): Promise<Response> {
  if (!(await requireAuth(request, env))) return unauthorized();
  if (request.method === "GET") {
    const id = url.pathname.replace("/api/mappings", "").slice(1);
    if (id) {
      const val = await getMapping(env, id);
      return val ? okJson({ key: id, url: val }) : okJson({ error: "not_found" }, { status: 404 });
    }
    const prefix = url.searchParams.get("prefix") || "";
    const list = await listMappings(env, prefix);
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
    await setMapping(env, id, target);
    return okJson({ ok: true, key: id, url: target });
  }
  if (request.method === "DELETE") {
    const id = url.pathname.replace("/api/mappings", "").slice(1);
    if (!id) return okJson({ error: "bad_key" }, { status: 400 });
    await deleteMapping(env, id);
    return okJson({ ok: true });
  }
  return okJson({ error: "method_not_allowed" }, { status: 405 });
}
