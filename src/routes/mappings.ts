import { okJson, unauthorized } from "../lib/http";
import { Env } from "../env";
import { requireAuth } from "../services/auth";
import { listMappings, getMapping, setMapping, deleteMapping, listAllMappings, wipeMappings, getTotalMappingsCount, batchSetMappings, batchGetMappings } from "../services/kv";

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
      const streamMode = url.searchParams.get("stream") === "1";
      
      if (streamMode) {
        // Streaming export with batch processing for better performance
        const { readable, writable } = new TransformStream();
        (async () => {
          const writer = writable.getWriter();
          const enc = new TextEncoder();
          
          try {
            // Write CSV header
            await writer.write(enc.encode("key,url\n"));
            
            // Get all keys first
            const keys = await listAllMappings(env);
            
            // Process in batches and stream results
            const batchResults = await batchGetMappings(env, keys);
            
            for (const { key, url } of batchResults) {
              const keyEsc = '"' + key.replace(/"/g, '""') + '"';
              const valEsc = url ? '"' + url.replace(/"/g, '""') + '"' : '""';
              await writer.write(enc.encode(`${keyEsc},${valEsc}\n`));
            }
          } catch (error) {
            console.error('Export error:', error);
          } finally {
            await writer.close();
          }
        })();
        
        return new Response(readable, {
          status: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename=mappings-export.csv`
          }
        });
      } else {
        // Non-streaming export with batch processing
        const keys = await listAllMappings(env);
        const results = await batchGetMappings(env, keys);
        
        let csv = "key,url\n";
        for (const { key, url } of results) {
          const keyEsc = '"' + key.replace(/"/g, '""') + '"';
          const valEsc = url ? '"' + url.replace(/"/g, '""') + '"' : '""';
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
    }
    
    // Batch mode - return keys with their URLs in one call
    if (url.searchParams.get("batch") === "true") {
      const prefix = url.searchParams.get("prefix") || "";
      const limit = parseInt(url.searchParams.get("limit") || "0", 10) || undefined;
      const cursor = url.searchParams.get("cursor") || undefined;
      const list = await listMappings(env, prefix.toUpperCase(), limit, cursor);
      
      // Get total count for pagination info (only on first page to avoid performance hit)
      let totalCount = undefined;
      if (!cursor) {
        totalCount = await getTotalMappingsCount(env, prefix.toUpperCase());
      }
      
      // Fetch all URLs using batch processing for better performance
      const itemsWithUrls = await batchGetMappings(env, list.keys);
      const formattedItems = itemsWithUrls.map(({ key, url }) => ({
        name: key,
        url: url || ''
      }));
      
      return okJson({
        keys: formattedItems,
        list_complete: list.list_complete,
        cursor: list.cursor,
        total_count: totalCount
      });
    }
    const prefix = url.searchParams.get("prefix") || "";
    const limit = parseInt(url.searchParams.get("limit") || "0", 10) || undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    const list = await listMappings(env, prefix.toUpperCase(), limit, cursor);
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
    // Import CSV: supports optional progress streaming when ?progress=1
    const text = await request.text();
    
    // Parse CSV: header key,url expected
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return okJson({ error: "empty_csv" }, { status: 400 });
    const header = lines.shift()!;
    const cols = header.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
    const kIdx = cols.findIndex(c => c.toLowerCase() === 'key');
    const vIdx = cols.findIndex(c => c.toLowerCase() === 'url');
    if (kIdx === -1 || vIdx === -1) return okJson({ error: "bad_header" }, { status: 400 });

    const total = lines.length;
    const progressMode = url.searchParams.get('progress') === '1';
    const reservedPrefixes = ['CONFIG:', 'SESS:'];

    if (progressMode) {
      // Stream NDJSON progress updates back to client while processing in batches
      const { readable, writable } = new TransformStream();
      (async () => {
        const writer = writable.getWriter();
        const enc = new TextEncoder();
        let count = 0;
        try {
          // wipe first (but preserve CONFIG:/SESS: keys via wipeMappings implementation)
          await wipeMappings(env);
          
          // Parse and validate all records first, then batch process
          const validMappings: Array<{ key: string; url: string }> = [];
          
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
            
            // Allow empty URLs and validate only non-empty URLs
            let isValidUrl = true;
            if (rawUrl && rawUrl.length > 0) {
              try {
                const u = new URL(rawUrl);
                if (u.protocol !== 'https:') {
                  isValidUrl = false;
                }
              } catch {
                isValidUrl = false;
              }
            }
            
            // Store the mapping regardless of URL validity (empty URLs are allowed)
            const up = canonical(rawKey);
            if (!reservedPrefixes.some(p=>up.startsWith(p))) {
              validMappings.push({ key: up, url: rawUrl }); // Store even if URL is empty or invalid
            }
          }
          
          // Process in batches with progress updates
          const BATCH_SIZE = 50;
          let totalErrors = 0;
          const allErrors: string[] = [];
          
          for (let i = 0; i < validMappings.length; i += BATCH_SIZE) {
            const batch = validMappings.slice(i, i + BATCH_SIZE);
            const result = await batchSetMappings(env, batch);
            
            if (!result.success) {
              totalErrors += result.errorCount;
              allErrors.push(...result.errors);
            }
            
            count += result.successCount;
            
            // Send progress update
            await writer.write(enc.encode(JSON.stringify({ 
              count, 
              total, 
              pct: Math.round((count/total)*100),
              errors: totalErrors > 0 ? totalErrors : undefined
            }) + '\n'));
          }
          
          await writer.write(enc.encode(JSON.stringify({ 
            done: true, 
            count, 
            total, 
            pct: 100,
            errors: totalErrors > 0 ? { count: totalErrors, details: allErrors.slice(0, 5) } : undefined
          }) + '\n'));
        } catch (e: any) {
          await writer.write(enc.encode(JSON.stringify({ error: e && (e.message||String(e)) }) + '\n'));
        } finally {
          await writer.close();
        }
      })();
      return new Response(readable, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
    }

    // Non-progress mode: batch processing for better performance
    await wipeMappings(env);
    
    // Parse and validate all records first
    const validMappings: Array<{ key: string; url: string }> = [];
    
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
      
      // Allow empty URLs and validate only non-empty URLs
      let isValidUrl = true;
      if (rawUrl && rawUrl.length > 0) {
        try {
          const u = new URL(rawUrl);
          if (u.protocol !== 'https:') {
            isValidUrl = false;
          }
        } catch {
          isValidUrl = false;
        }
      }
      
      // Store the mapping regardless of URL validity (empty URLs are allowed)
      const up = canonical(rawKey);
      if (!reservedPrefixes.some(p=>up.startsWith(p))) {
        validMappings.push({ key: up, url: rawUrl }); // Store even if URL is empty or invalid
      }
    }
    
    // Batch insert all valid mappings
    const result = await batchSetMappings(env, validMappings);
    
    if (result.success) {
      return okJson({ ok: true, imported: result.successCount, failed: result.errorCount, total });
    } else {
      return okJson({ 
        ok: false, 
        error: 'Import failed',
        imported: result.successCount,
        failed: result.errorCount,
        details: result.errors,
        total 
      }, { status: 500 });
    }
  }
  return okJson({ error: "method_not_allowed" }, { status: 405 });
}
