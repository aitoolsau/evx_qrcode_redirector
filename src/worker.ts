export interface Env {
  COUNTRY_CODE?: string; // default AU
  // KV for mappings and sessions (prefix SESS: for session tokens)
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

async function requireAuth(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  const exists = await env.MAPPINGS.get(`SESS:${token}`);
  return !!exists;
}

function adminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EVX – Log In</title>
  <style>
    body{background:#f0f0f1;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0}
    #login{width:320px;margin:6% auto 2rem;padding:0}
  .logo{text-align:center;margin-bottom:1rem}
  .logo img{max-width:180px;height:auto}
    .login-card{background:#fff;border:1px solid #c3c4c7;box-shadow:0 1px 3px rgba(0,0,0,.04);padding:26px}
    .login-card h1{font-size:1.1rem;margin:.2rem 0 1rem 0;color:#1d2327}
    label{display:block;margin:8px 0 4px;color:#1d2327;font-size:13px}
    input{width:100%;padding:8px;border:1px solid #8c8f94;border-radius:3px;background:#fff}
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
      <form id="login-form">
        <label for="user">Username or Email Address</label>
        <input id="user" autocomplete="username" required />
        <label for="pass">Password</label>
        <input id="pass" type="password" autocomplete="current-password" required />
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
        <button class="button-primary" type="submit">Save Mapping</button>
        <div id="save-msg" class="msg"></div>
      </form>
    </section>
    <section class="card">
      <div class="row"><input id="prefix" placeholder="Filter by prefix (optional)" /><button id="refresh" class="button-primary" type="button">Refresh</button></div>
      <table id="list"><thead><tr><th>Key</th><th>Value</th><th></th></tr></thead><tbody></tbody></table>
    </section>
  </div>

  <script>
    async function api(path, opts){
      const r = await fetch(path, Object.assign({credentials:'include'}, opts||{}));
      const ct = r.headers.get('content-type')||'';
      const body = ct.includes('application/json')? await r.json(): await r.text();
      if(!r.ok) throw new Error((body && body.error) || r.statusText);
      return body;
    }
    function getParam(name){ const u=new URL(window.location.href); return u.searchParams.get(name); }
    async function checkAuth(){
      try { await api('/api/me');
        document.getElementById('login').style.display='none';
        document.getElementById('app').style.display='block';
      } catch {
        document.getElementById('login').style.display='block';
        document.getElementById('app').style.display='none';
      }
    }
    document.getElementById('login-form').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const user = document.getElementById('user').value.trim();
      const pass = document.getElementById('pass').value;
      const msg = document.getElementById('login-msg'); msg.textContent=''; msg.className='msg';
      try {
        await api('/api/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({user, pass})});
        const rd = getParam('redirect_to'); if(rd){ window.location.href = rd; return; }
        msg.textContent='Logged in'; msg.className='msg ok'; await checkAuth();
      } catch(err){ msg.textContent = err.message; msg.className='msg err'; }
    });
    document.getElementById('logout').addEventListener('click', async ()=>{ await api('/api/logout', {method:'POST'}); window.location.href = '/admin'; });
    document.getElementById('refresh').addEventListener('click', loadList);
    document.getElementById('upsert').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const key = document.getElementById('cid').value.trim();
      const url = document.getElementById('url').value.trim();
      const msg = document.getElementById('save-msg'); msg.textContent=''; msg.className='msg';
      try { await api('/api/mappings/'+encodeURIComponent(key), {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({url})});
        msg.textContent = 'Saved'; msg.className='msg ok'; await loadList();
      } catch(err){ msg.textContent = err.message; msg.className='msg err'; }
    });
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
                       '<td><button data-k="'+ item.name +'">Delete</button></td>';
        tbody.appendChild(tr);
      }
      tbody.addEventListener('click', async (e)=>{
        if(e.target.tagName==='BUTTON'){
          const k = e.target.getAttribute('data-k');
          await api('/api/mappings/'+encodeURIComponent(k), {method:'DELETE'});
          await loadList();
        }
      }, {once:true});
    }
    checkAuth();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
    if (url.pathname === "/api/me") {
      const authed = await requireAuth(request, env);
      return authed ? okJson({ ok: true }) : unauthorized();
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const user = String((body as any).user || "");
        const pass = String((body as any).pass || "");
        const uOk = (env.ADMIN_USERNAME || "admin") === String(user || "");
        const pOk = (env.ADMIN_PASSWORD || "") === String(pass || "");
        if (!uOk || !pOk) return unauthorized();
        const tokenBytes = new Uint8Array(16);
        crypto.getRandomValues(tokenBytes);
        const token = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, '-').replace(/\//g, '_');
        await env.MAPPINGS.put(`SESS:${token}`, "1", { expirationTtl: 3600 });
        const headers = new Headers({ "set-cookie": `admin_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` });
        return okJson({ ok: true }, { headers });
      } catch {
        return okJson({ error: "bad_request" }, { status: 400 });
      }
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      const cookie = request.headers.get("cookie") || "";
      const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
      if (m) {
        await env.MAPPINGS.delete(`SESS:${decodeURIComponent(m[1])}`);
      }
      const headers = new Headers({ "set-cookie": `admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` });
      return okJson({ ok: true }, { headers });
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
  // filter out session keys
  const filtered = list.keys.filter((k: any) => !k.name.startsWith("SESS:"));
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
  },
};
