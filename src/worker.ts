export interface Env {
  COUNTRY_CODE?: string; // default AU
  // KV for chargerID -> URL mappings
  MAPPINGS: any;
  // Optional simple admin creds (single-user)
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string; // set via wrangler secret or env var
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

function okJson(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
    status: init.status || 200,
  });
}

function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init.headers || {}),
    },
    status: init.status || 200,
  });
}

function unauthorized(): Response {
  return okJson({ error: "unauthorized" }, { status: 401 });
}

// Stateless session: HMAC-signed payload { u, iat, exp }
function b64urlFromString(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function stringFromB64url(b: string): string {
  const base = b.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base + '==='.slice((base.length + 3) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const bytes = new Uint8Array(sig);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function hmacVerify(secret: string, data: string, sig: string): Promise<boolean> {
  const expected = await hmacSign(secret, data);
  return expected === sig; // acceptable here
}

// Session version support: bump to force re-login across all clients
async function getSessionVersion(env: Env): Promise<number> {
  const v = await env.MAPPINGS.get('CONFIG:SESSION_VERSION');
  const n = Number(v || 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
async function bumpSessionVersion(env: Env): Promise<number> {
  const v = (await getSessionVersion(env)) + 1;
  await env.MAPPINGS.put('CONFIG:SESSION_VERSION', String(v));
  return v;
}

// Password hashing (PBKDF2-SHA256) stored in KV under CONFIG:ADMIN_PW
async function pbkdf2Hash(password: string, salt: any, iterations = 100_000): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, keyMaterial, 256);
  return new Uint8Array(bits);
}
function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlToBytes(b: string): Uint8Array {
  const base = b.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base + '==='.slice((base.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function verifyPassword(pass: string, env: Env): Promise<boolean> {
  const rec = await env.MAPPINGS.get('CONFIG:ADMIN_PW');
  if (rec) {
    try {
      const cfg = JSON.parse(rec);
      const salt = b64urlToBytes(String(cfg.salt || ''));
      const it = Number(cfg.iterations || 100_000);
  const expect = String(cfg.hash || '');
  const got = await pbkdf2Hash(pass, salt, it);
      return bytesToB64url(got) === expect;
    } catch {
  // Stored record exists but is unreadable; do not fall back
  return false;
    }
  }
  return (env.ADMIN_PASSWORD || '') === pass;
}
async function requireAuth(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  const parts = token.split('.')
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const secret = (env as any).SESSION_SECRET || env.ADMIN_PASSWORD || '';
  if (!secret) return false;
  if (!(await hmacVerify(secret, payloadB64, sig))) return false;
  try {
    const payload = JSON.parse(stringFromB64url(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload !== 'object') return false;
    if (payload.exp && now > Number(payload.exp)) return false;
  // Enforce session version for all protected APIs
  const ver = await getSessionVersion(env);
  if (payload.v === undefined) return false;
  if (Number(payload.v) !== ver) return false;
  return true;
  } catch {
    return false;
  }
}

function adminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EVX Charger QR Redirect</title>
  <style>
    body{background:#f0f0f1;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0}
    #login{width:320px;margin:6% auto 2rem;padding:0}
  .logo{text-align:center;margin-bottom:1rem}
  .logo img{max-width:180px;height:auto}
    .login-card{background:#fff;border:1px solid #c3c4c7;box-shadow:0 1px 3px rgba(0,0,0,.04);padding:26px}
    .login-card h1{font-size:1.1rem;margin:.2rem 0 1rem 0;color:#1d2327}
    label{display:block;margin:8px 0 4px;color:#1d2327;font-size:13px}
    input{width:100%;padding:8px;border:1px solid #8c8f94;border-radius:3px;background:#fff}
  /* Add a slight extra right margin on login inputs to balance spacing */
  #login input{margin-right:8px;width:calc(100% - 8px)}
    .button-primary{background:#2271b1;border-color:#2271b1;color:#fff;text-decoration:none;text-shadow:none;padding:8px 14px;border-radius:3px;border:1px solid transparent;cursor:pointer;display:inline-block;margin-top:12px}
    .button-primary:hover{background:#135e96}
    .msg{margin-top:8px;font-size:12px;color:#646970}
    .ok{color:#1e7e34}.err{color:#b32d2e}
    header{max-width:880px;margin:1rem auto;padding:0 1rem;display:flex;justify-content:space-between;align-items:center}
    .app-wrap{max-width:880px;margin:1rem auto;padding:0 1rem}
    .card{border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:1rem 0;background:#fff}
    table{width:100%;border-collapse:collapse}th,td{padding:.5rem;border-bottom:1px solid #f1f5f9}
    .row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
  </style>
</head>
<body>
  <div id="login">
    <div class="logo"><img src="https://evx.tech/wp-content/uploads/2022/05/EVX-Logo-1.png" alt="EVX logo" /></div>
    <div class="login-card">
      <h1>Log In</h1>
      <form id="login-form" method="post" action="/login">
        <label for="user">Username or Email Address</label>
        <input id="user" name="user" autocomplete="username" required />
        <label for="pass">Password</label>
        <input id="pass" name="pass" type="password" autocomplete="current-password" required />
        <button class="button-primary" type="submit">Log In</button>
        <div id="login-msg" class="msg"></div>
      </form>
    </div>
  </div>

  <div id="app" class="app-wrap" style="display:none">
    <header><h1>EVX QR Redirector Admin</h1><button id="logout" class="button-primary" style="background:#d63638">Logout</button></header>
    <section class="card">
      <h2>Create / Update Mapping</h2>
      <form id="upsert">
        <div class="row"><label for="cid">Charger ID</label><input id="cid" placeholder="20501B" required /></div>
        <div class="row"><label for="url">Target URL</label><input id="url" placeholder="https://cp.evx.tech/public/cs/qr?evseid=AU*EVX*20501B" required /></div>
        <div class="row">
          <button id="save-btn" class="button-primary" type="submit">Add Mapping</button>
          <button id="clear-btn" type="button">Clear</button>
        </div>
        <div id="save-msg" class="msg"></div>
      </form>
    </section>
    <section class="card">
      <div class="row"><input id="prefix" placeholder="Filter by prefix (optional)" /><button id="refresh" class="button-primary" type="button">Refresh</button></div>
  <table id="list"><thead><tr><th>Key</th><th>Value</th><th style="width:160px">Actions</th></tr></thead><tbody></tbody></table>
    </section>

    <section class="card">
      <h2>Change Admin Password</h2>
      <form id="pwform">
        <div class="row"><label for="pw_current">Current Password</label><input id="pw_current" type="password" autocomplete="current-password" required /></div>
        <div class="row"><label for="pw_new">New Password</label><input id="pw_new" type="password" autocomplete="new-password" required /></div>
        <div class="row"><label for="pw_confirm">Confirm New Password</label><input id="pw_confirm" type="password" autocomplete="new-password" required /></div>
        <button class="button-primary" type="submit">Update Password</button>
        <div id="pw-msg" class="msg"></div>
      </form>
  <div id="pw-meta" class="msg"></div>
  <div class="msg">Note: Password changes take effect immediately. Your current session remains valid.</div>
    </section>
  </div>

  <script>
  let isEditing = false;
    async function api(path, opts){
      const r = await fetch(path, Object.assign({credentials:'include'}, opts||{}));
      const ct = r.headers.get('content-type')||'';
      const body = ct.includes('application/json')? await r.json(): await r.text();
  if(!r.ok) throw new Error((body && (body.message || body.error)) || r.statusText);
      return body;
    }
    function getParam(name){ const u=new URL(window.location.href); return u.searchParams.get(name); }
    async function checkAuth(){
      try { await api('/api/me');
        document.getElementById('login').style.display='none';
        document.getElementById('app').style.display='block';
  loadPwMeta().catch(()=>{});
      } catch {
        document.getElementById('login').style.display='block';
        document.getElementById('app').style.display='none';
      }
    }
  // No JS login submit handler; the form POSTs to /login which sets cookie and redirects.
  document.getElementById('logout').addEventListener('click', async ()=>{ window.location.href = '/logout'; });
    document.getElementById('refresh').addEventListener('click', loadList);
    // Pressing Enter in the filter triggers refresh
    document.getElementById('prefix').addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') { e.preventDefault(); loadList(); }
    });
    document.getElementById('clear-btn').addEventListener('click', ()=>{
      (document.getElementById('cid')).value = '';
      (document.getElementById('url')).value = '';
      isEditing = false;
      document.getElementById('save-btn').textContent = 'Add Mapping';
      document.getElementById('save-msg').textContent = '';
      document.getElementById('cid').focus();
    });
    document.getElementById('upsert').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const key = document.getElementById('cid').value.trim();
      const url = document.getElementById('url').value.trim();
      const msg = document.getElementById('save-msg'); msg.textContent=''; msg.className='msg';
      try { await api('/api/mappings/'+encodeURIComponent(key), {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({url})});
        msg.textContent = isEditing ? 'Updated' : 'Added';
        msg.className='msg ok';
        await loadList();
        // Return to add mode after save
        isEditing = false;
        (document.getElementById('cid')).value = '';
        (document.getElementById('url')).value = '';
        document.getElementById('save-btn').textContent = 'Add Mapping';
      } catch(err){ msg.textContent = err.message; msg.className='msg err'; }
    });

    document.getElementById('pwform').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const cur = (document.getElementById('pw_current')).value;
      const nn = (document.getElementById('pw_new')).value;
      const cf = (document.getElementById('pw_confirm')).value;
      const msg = document.getElementById('pw-msg'); msg.textContent=''; msg.className='msg';
      if(nn !== cf){ msg.textContent = 'New passwords do not match'; msg.className='msg err'; return; }
      if(nn.length < 8){ msg.textContent = 'Password must be at least 8 characters'; msg.className='msg err'; return; }
      try {
        const res = await api('/api/password', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ current: cur, next: nn }) });
        if (res && res.visible === false) {
          msg.textContent = 'Password updated, syncing... this may take a few seconds';
          msg.className='msg';
        } else {
          msg.textContent = 'Password updated'; msg.className='msg ok';
        }
        (document.getElementById('pw_current')).value='';
        (document.getElementById('pw_new')).value='';
        (document.getElementById('pw_confirm')).value='';
        // Try multiple times (up to ~10s) to see the new hash appear
        let attempts = 0;
        while (attempts < 20) {
          await loadPwMeta();
          const txt = document.getElementById('pw-meta').textContent || '';
          if (!txt.includes('Using default ADMIN_PASSWORD')) break;
          await new Promise(r=>setTimeout(r, 500));
          attempts++;
        }
      } catch(err){ msg.textContent = err.message; msg.className='msg err'; }
    });
    async function loadPwMeta(attempt=0){
      const meta = await api('/api/password');
      const el = document.getElementById('pw-meta');
      if(meta && meta.hasRecord){
        const when = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : 'unknown time';
        el.textContent = 'Password last updated: ' + when + (meta.iterations ? ' • PBKDF2 iterations: ' + meta.iterations : '');
      } else {
        el.textContent = 'Using default ADMIN_PASSWORD secret (no stored hash yet).';
        if (attempt < 3) setTimeout(()=>loadPwMeta(attempt+1), 500);
      }
    }
    async function loadList(){
      const prefix = document.getElementById('prefix').value.trim();
      const data = await api('/api/mappings?prefix='+encodeURIComponent(prefix));
      const tbody = document.querySelector('#list tbody');
      tbody.innerHTML = '';
      for(const item of data.keys){
        const tr = document.createElement('tr');
        const val = await api('/api/mappings/'+encodeURIComponent(item.name));
        tr.innerHTML = '<td><code>'+ item.name +'</code></td>'+
                       '<td><a href="'+ val.url +'" target="_blank">'+ val.url +'</a></td>'+
                       '<td>'+
                         '<button data-action="edit" data-k="'+ item.name +'" style="margin-right:6px">Edit</button>'+
                         '<button data-action="delete" data-k="'+ item.name +'">Delete</button>'+
                       '</td>';
        tbody.appendChild(tr);
      }
      // Single persistent click handler each time loadList is called (plain JS)
      tbody.onclick = async (e)=>{
        const t = e.target;
        if(t && t.tagName === 'BUTTON'){
          const action = t.getAttribute('data-action');
          const k = t.getAttribute('data-k');
          if(!k) return;
          if(action === 'delete'){
            await api('/api/mappings/'+encodeURIComponent(k), {method:'DELETE'});
            await loadList();
          } else if(action === 'edit'){
            const v = await api('/api/mappings/'+encodeURIComponent(k));
            (document.getElementById('cid')).value = k;
            (document.getElementById('url')).value = v.url || '';
            isEditing = true;
            document.getElementById('save-btn').textContent = 'Update Mapping';
            document.getElementById('cid').focus();
          }
        }
      };
    }
    checkAuth();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

    // Only host cpr.evx.tech
    if (url.hostname !== "cpr.evx.tech") {
      return new Response("Not found", { status: 404 });
    }

    // Admin UI & APIs
    if (url.pathname === "/admin") {
      return html(adminPage());
    }

    // Auth-related endpoints
    if (url.pathname === "/login" && request.method === "POST") {
      // Handle form-encoded login to avoid any JS/cookie issues
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
  const pOk = await verifyPassword(pass, env);
      if (!uOk || !pOk) return html('<script>location.href="/admin?login=failed"</script>', { status: 401 });
  const iat = Math.floor(Date.now()/1000);
  const exp = iat + 3600;
  const ver = await getSessionVersion(env);
  const payload = { u: user, iat, exp, v: ver };
      const payloadB64 = b64urlFromString(JSON.stringify(payload));
  const sig = await hmacSign((env as any).SESSION_SECRET || env.ADMIN_PASSWORD || '', payloadB64);
      const token = `${payloadB64}.${sig}`;
      const headers = new Headers({ "Set-Cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` });
      const rd = url.searchParams.get('redirect_to') || '/admin';
      headers.set('Location', rd);
      return new Response(null, { status: 303, headers });
    }
    if (url.pathname === "/api/me") {
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
  // Optional: enforce session version match
  const ver = await getSessionVersion(env);
  if (payload.v && Number(payload.v) !== ver) return debug ? okJson({ error: 'unauthorized', reason: 'session_version' }, { status: 401 }) : unauthorized();
        return okJson({ ok: true });
      } catch {
        return debug ? okJson({ error: 'unauthorized', reason: 'bad_payload' }, { status: 401 }) : unauthorized();
      }
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const user = String((body as any).user || "");
        const pass = String((body as any).pass || "");
  const uOk = (env.ADMIN_USERNAME || "admin") === String(user || "");
  const pOk = await verifyPassword(String(pass || ""), env);
        if (!uOk || !pOk) return unauthorized();
  const iat = Math.floor(Date.now()/1000);
  const exp = iat + 3600;
  const ver = await getSessionVersion(env);
  const payload = { u: user, iat, exp, v: ver };
  const payloadB64 = b64urlFromString(JSON.stringify(payload));
  const sig = await hmacSign((env as any).SESSION_SECRET || env.ADMIN_PASSWORD || '', payloadB64);
  const token = `${payloadB64}.${sig}`;
  const headers = new Headers({ "Set-Cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` });
        return okJson({ ok: true }, { headers });
      } catch {
        return okJson({ error: "bad_request" }, { status: 400 });
      }
    }
    if (url.pathname === "/api/password" && request.method === "GET") {
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
    if (url.pathname === "/api/password" && request.method === "POST") {
      try {
        if (!(await requireAuth(request, env))) return unauthorized();
        const body = await request.json().catch(()=>({}));
        const current = String((body as any).current || '');
        const next = String((body as any).next || '');
        if (next.length < 8) return okJson({ error: 'weak_password' }, { status: 400 });
        const ok = await verifyPassword(current, env);
        if (!ok) return okJson({ error: 'bad_current' }, { status: 403 });
        const salt = new Uint8Array(16); crypto.getRandomValues(salt);
        const iterations = 100_000;
        const hash = await pbkdf2Hash(next, salt, iterations);
        const rec = { iterations, salt: bytesToB64url(salt), hash: bytesToB64url(hash), updatedAt: new Date().toISOString() };
        await env.MAPPINGS.put('CONFIG:ADMIN_PW', JSON.stringify(rec));
        await bumpSessionVersion(env); // force re-login everywhere
        const after = await env.MAPPINGS.get('CONFIG:ADMIN_PW');
        return okJson({ ok: true, visible: Boolean(after) });
      } catch (e: any) {
        const msg = e && (e.message || String(e));
        return okJson({ error: 'internal_error', message: msg }, { status: 500 });
      }
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      const cookie = request.headers.get("cookie") || "";
      const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  const headers = new Headers({ "Set-Cookie": `admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` });
      return okJson({ ok: true }, { headers });
    }

    // GET /logout helper for client redirects
    if (url.pathname === "/logout" && request.method === "GET") {
      const headers = new Headers({ "Set-Cookie": `admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` });
      headers.set('Location', '/admin');
      return new Response(null, { status: 303, headers });
    }

    // Authenticated debug to check CONFIG state
    if (url.pathname === "/api/debug/config" && request.method === "GET") {
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

    // Mappings CRUD (auth required)
    if (url.pathname.startsWith("/api/mappings")) {
      if (!(await requireAuth(request, env))) return unauthorized();
      if (request.method === "GET") {
        const id = url.pathname.replace("/api/mappings", "").slice(1);
        if (id) {
          const val = await env.MAPPINGS.get(id);
          return val ? okJson({ key: id, url: val }) : okJson({ error: "not_found" }, { status: 404 });
        }
    const prefix = url.searchParams.get("prefix") || "";
  const list = await env.MAPPINGS.list({ prefix });
  // filter out internal keys
  const filtered = list.keys.filter((k: any) => !k.name.startsWith("SESS:") && !k.name.startsWith("CONFIG:"));
  return okJson({ keys: filtered });
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
        await env.MAPPINGS.put(id, target);
        return okJson({ ok: true, key: id, url: target });
      }
      if (request.method === "DELETE") {
        const id = url.pathname.replace("/api/mappings", "").slice(1);
        if (!id) return okJson({ error: "bad_key" }, { status: 400 });
        await env.MAPPINGS.delete(id);
        return okJson({ ok: true });
      }
      return okJson({ error: "method_not_allowed" }, { status: 405 });
    }

    // Prevent redirect loop: do not redirect /public/cs/qr, or if query already includes identifiers
    if (
      url.pathname === "/public/cs/qr" ||
      url.searchParams.has("evseid") ||
      url.searchParams.has("revseid")
    ) {
      return new Response("OK", { status: 200 });
    }

    // Match /public/cs/{CHARGERID} with optional trailing slash, but exclude 'qr' as a chargerID
    const m = url.pathname.match(/^\/public\/cs\/([A-Za-z0-9]+)\/?$/);
    if (!m || m[1].toLowerCase() === "qr") {
      return new Response("Not found", { status: 404 });
    }

    const chargerId = m[1];

    // Prefer explicit mapping from KV; fall back to computed URL format
    let target = await env.MAPPINGS.get(chargerId);
    if (!target) {
      const cc = (env.COUNTRY_CODE || "AU").toUpperCase();
      const dest = new URL("https://cp.evx.tech/public/cs/qr");
      dest.searchParams.set("evseid", `${cc}*EVX*${chargerId}`);
      target = dest.toString();
    }

      return Response.redirect(target, 302);
    } catch (err: any) {
      try { console.error('Unhandled worker error:', err && (err.stack || err.message || String(err))); } catch {}
      const msg = (err && (err.message || String(err))) || 'internal_error';
      return okJson({ error: 'internal_error', message: msg }, { status: 500 });
    }
  },
};
