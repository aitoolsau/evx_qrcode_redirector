import { okJson } from "../lib/http";
import { Env } from "../env";

export async function handleHealth(env: Env): Promise<Response> {
  // Lightweight KV check: list up to 1 key (cheap) and measure time.
  const start = Date.now();
  let kvOk = true;
  let keyCountSample = 0;
  try {
    const list = await env.MAPPINGS.list({});
    keyCountSample = list.keys.length;
  } catch (e) {
    kvOk = false;
  }
  const ms = Date.now() - start;
  return okJson({
    status: kvOk ? 'ok' : 'degraded',
    components: {
      kv: kvOk ? 'ok' : 'error'
    },
    sampleKeys: keyCountSample,
    latencyMs: ms,
    time: new Date().toISOString()
  });
}
