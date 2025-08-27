import { html } from "../lib/http";

export function adminPage(): string {
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
    /* Unified button system */
    .btn, .button-primary{display:inline-block;padding:8px 14px;border-radius:3px;border:1px solid transparent;cursor:pointer;text-decoration:none;text-shadow:none;font-size:14px;line-height:1.2}
    .btn + .btn{margin-left:6px}
    .btn-primary, .button-primary{background:#2271b1;border-color:#2271b1;color:#fff}
    .btn-primary:hover, .button-primary:hover{background:#135e96}
    .btn-secondary{background:#f3f4f6;border-color:#e5e7eb;color:#1f2937}
    .btn-secondary:hover{background:#e5e7eb}
    .btn-danger{background:#d63638;border-color:#d63638;color:#fff}
    .btn-danger:hover{background:#b82a2c}
    .msg{margin-top:8px;font-size:12px;color:#646970}
    .ok{color:#1e7e34}.err{color:#b32d2e}
    header{max-width:880px;margin:1rem auto;padding:0 1rem;display:flex;justify-content:space-between;align-items:center}
  .brand{display:flex;align-items:center;gap:.5rem}
  .brand-logo{height:28px;width:auto}
    .app-wrap{max-width:880px;margin:1rem auto;padding:0 1rem}
    .card{border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:1rem 0;background:#fff}
    table{width:100%;border-collapse:collapse}th,td{padding:.5rem;border-bottom:1px solid #f1f5f9}
    .row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
  /* Modal */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:50}
  .modal{background:#fff;max-width:520px;width:92%;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,.15);padding:1rem}
  .modal h3{margin:.25rem 0 0.5rem;font-size:18px}
  .modal p{margin:.25rem 0 .75rem;color:#334155}
  .modal .actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.5rem}
  /* Spinner */
  .spinner{width:28px;height:28px;border:4px solid #e5e7eb;border-top-color:#2271b1;border-radius:50%;animation:spin 0.8s linear infinite;margin:.5rem auto}
  @keyframes spin{to{transform:rotate(360deg)}}
  .loading-inline{display:inline-flex;align-items:center;gap:.5rem}
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
  <button class="btn btn-primary" type="submit">Log In</button>
        <div id="login-msg" class="msg"></div>
      </form>
    </div>
  </div>

  <div id="app" class="app-wrap" style="display:none">
    <header>
      <div class="brand">
        <img class="brand-logo" src="https://evx.tech/wp-content/uploads/2022/05/EVX-Logo-1.png" alt="EVX" />
        <h1> QR Redirector Admin</h1>
      </div>
  <button id="logout" class="btn btn-danger">Logout</button>
    </header>
    <section class="card">
      <h2>Create / Update Mapping</h2>
      <form id="upsert">
        <div class="row"><label for="cid">Charger ID</label><input id="cid" placeholder="20501B" required /></div>
        <div class="row"><label for="url">Target URL</label><input id="url" placeholder="https://cp.evx.tech/public/cs/qr?evseid=AU*EVX*20501B" required /></div>
        <div class="row">
          <button id="save-btn" class="btn btn-primary" type="submit">Add Mapping</button>
          <button id="clear-btn" class="btn btn-secondary" type="button">Clear</button>
        </div>
        <div id="save-msg" class="msg"></div>
      </form>
    </section>
    <section class="card">
  <div class="row"><input id="prefix" placeholder="Filter by prefix (optional)" /><button id="refresh" class="btn btn-secondary" type="button">Refresh</button></div>
  <table id="list"><thead><tr><th>Key</th><th>Value</th><th style="width:160px">Actions</th></tr></thead><tbody></tbody></table>
    </section>

    <section class="card">
      <h2>Change Admin Password</h2>
      <form id="pwform">
        <div class="row"><label for="pw_current">Current Password</label><input id="pw_current" type="password" autocomplete="current-password" required /></div>
        <div class="row"><label for="pw_new">New Password</label><input id="pw_new" type="password" autocomplete="new-password" required /></div>
        <div class="row"><label for="pw_confirm">Confirm New Password</label><input id="pw_confirm" type="password" autocomplete="new-password" required /></div>
  <button class="btn btn-primary" type="submit">Update Password</button>
        <div id="pw-msg" class="msg"></div>
      </form>
  <div id="pw-meta" class="msg"></div>
  <div class="msg">Note: Password changes take effect immediately. Your current session remains valid.</div>
    </section>
    <section class="card">
      <h2>Import / Export</h2>
      <div class="row" style="margin-bottom:.5rem">
  <a id="exportCsv" class="btn btn-secondary" href="/api/mappings?format=csv" download>Export CSV</a>
      </div>
      <form id="importCsvForm">
        <div class="row">
          <label for="importCsv">Import CSV (key,url)</label>
          <input id="importCsv" type="file" accept=".csv,text/csv" />
        </div>
  <div class="row"><button class="btn btn-danger" type="submit">Import & Replace All</button></div>
        <div id="import-msg" class="msg"></div>
      </form>
      <div class="msg">Importing will delete all existing keys and replace them with the uploaded CSV.</div>
    </section>
    <section class="card" id="health-card">
      <h2>System Health</h2>
      <div id="health-status" class="msg">Loading...</div>
      <div id="health-details" style="font-size:12px;color:#334155;margin-top:.25rem"></div>
      <div class="row" style="margin-top:.5rem">
        <button id="health-refresh" type="button" class="btn btn-secondary">Refresh Health</button>
      </div>
    </section>
    <!-- Import Confirmation Modal -->
    <div id="importModal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="importModalTitle">
      <div class="modal">
        <h3 id="importModalTitle">Confirm Import</h3>
        <p>This will delete ALL existing mappings and replace them with the CSV you selected.</p>
        <p>A backup CSV will be downloaded first named <code>backup-YYYYMMDD_HHMMSS.csv</code> for rollback.</p>
        <div id="importModalMsg" class="msg"></div>
  <div id="importSpinner" class="spinner" style="display:none"></div>
        <div class="actions">
          <button id="importCancel" class="btn btn-secondary" type="button">Cancel</button>
          <button id="importConfirm" class="btn btn-danger" type="button">Confirm Import</button>
        </div>
      </div>
    </div>
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
  loadHealth().catch(()=>{});
      } catch {
        document.getElementById('login').style.display='block';
        document.getElementById('app').style.display='none';
      }
    }
    async function loadHealth(){
      const el = document.getElementById('health-status');
      const details = document.getElementById('health-details');
      try {
        el.textContent = 'Loading...';
        const h = await api('/api/health');
        el.textContent = 'Overall: ' + h.status;
        details.textContent = 'KV: ' + h.components.kv + ' • Latency: ' + h.latencyMs + 'ms • Keys sample: ' + h.sampleKeys + ' • ' + h.time;
        el.className = 'msg ' + (h.status === 'ok' ? 'ok' : (h.status === 'degraded' ? '' : 'err'));
      } catch(e){
        el.textContent = 'Health check failed';
        el.className = 'msg err';
        details.textContent = '';
      }
    }
    document.getElementById('health-refresh').addEventListener('click', ()=>loadHealth());
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

    // Import with confirmation and automatic backup
    let pendingImportCsvText = '';
    function ts(){
      const d = new Date();
      const pad = (n)=> String(n).padStart(2,'0');
      return '' + d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    }
    function downloadBlob(data, filename, mime){
      const blob = new Blob([data], { type: mime||'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
    }
    async function backupCurrent(){
      const res = await fetch('/api/mappings?format=csv', { credentials:'include' });
      if(!res.ok) throw new Error('Backup export failed');
      const csv = await res.text();
  downloadBlob(csv, 'backup-' + ts() + '.csv', 'text/csv');
    }
    function openImportModal(){
      const ov = document.getElementById('importModal');
      const mm = document.getElementById('importModalMsg');
      mm.textContent = '';
      ov.style.display = 'flex';
    }
    function closeImportModal(){
      const ov = document.getElementById('importModal');
      ov.style.display = 'none';
    }
    document.getElementById('importCsvForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const inp = document.getElementById('importCsv');
      const msg = document.getElementById('import-msg');
      msg.textContent=''; msg.className='msg';
      // @ts-ignore
      const file = inp && inp.files && inp.files[0];
      if (!file) { msg.textContent = 'Choose a CSV file first'; msg.className='msg err'; return; }
      pendingImportCsvText = await file.text();
      openImportModal();
    });
    document.getElementById('importCancel').addEventListener('click', ()=>{
      pendingImportCsvText = '';
      closeImportModal();
    });
    document.getElementById('importConfirm').addEventListener('click', async ()=>{
      const modalMsg = document.getElementById('importModalMsg');
      const pageMsg = document.getElementById('import-msg');
      const spin = document.getElementById('importSpinner');
      const confirmBtn = document.getElementById('importConfirm');
      const cancelBtn = document.getElementById('importCancel');
      function startSpin(txt){ modalMsg.textContent = txt; spin.style.display='block'; confirmBtn.disabled=true; cancelBtn.disabled=true; }
      function stopSpin(){ spin.style.display='none'; confirmBtn.disabled=false; cancelBtn.disabled=false; }
      startSpin('Creating backup...'); modalMsg.className='msg';
      try{
        await backupCurrent();
      } catch(err){
        stopSpin();
        modalMsg.textContent = 'Backup failed: ' + (err && err.message ? err.message : 'unknown error');
        modalMsg.className='msg err';
        return; // Abort import if backup failed
      }
      startSpin('Importing...');
      try{
        const res = await api('/api/mappings?import=csv', { method: 'POST', headers: { 'content-type': 'text/csv' }, body: pendingImportCsvText });
        pageMsg.textContent = 'Imported ' + (res.imported||0) + ' keys';
        pageMsg.className='msg ok';
        closeImportModal();
        pendingImportCsvText = '';
        await loadList();
      } catch(err){
        stopSpin();
        modalMsg.textContent = (err && err.message) ? err.message : 'Import failed';
        modalMsg.className='msg err';
        confirmBtn.disabled=false; cancelBtn.disabled=false;
      }
      stopSpin();
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
        try {
          const tr = document.createElement('tr');
          const val = await api('/api/mappings/'+encodeURIComponent(item.name));
          tr.innerHTML = '<td><code>'+ item.name +'</code></td>'+
                         '<td><a href="'+ val.url +'" target="_blank">'+ val.url +'</a></td>'+
                         '<td>'+
                           '<button class="btn btn-secondary" data-action="edit" data-k="'+ item.name +'">Edit</button>'+
                           '<button class="btn btn-danger" data-action="delete" data-k="'+ item.name +'">Delete</button>'+
                         '</td>';
          tbody.appendChild(tr);
        } catch(e){
          // Key may have been deleted/changed concurrently (e.g., during import). Skip it.
          continue;
        }
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

export function handleAdmin(): Response {
  return html(adminPage());
}
