/* ============================================================
   tickets.js — Incident Ticket Tracker with Kanban Board
   ============================================================ */
'use strict';

const TK_KEY = 'sw_tickets';

/* ---- Default sample tickets ---- */
function defaultTickets() {
  const now = Date.now();
  return [
    {
      id: 'TK-001',
      title: 'Web server tidak bisa diakses dari internet',
      desc: 'User melaporkan halaman web company.com tidak bisa dibuka. Error "502 Bad Gateway" muncul sejak pukul 09.15 WIB. Semua departemen terdampak.',
      priority: 'critical',
      category: 'Network',
      serverId: 'srv_001',
      pic: 'Tim NOC',
      status: 'in-progress',
      slaHours: 1,
      createdAt: now - 1000 * 60 * 45,
      updatedAt: now - 1000 * 60 * 10,
      comments: [
        { author: 'Budi', text: 'Sudah dicek di switch, link Rack-A1 masih UP. Kemungkinan di level nginx.', time: now - 1000 * 60 * 30 },
        { author: 'Rina', text: 'nginx worker process restart loop. Sedang investigasi config.', time: now - 1000 * 60 * 10 },
      ],
      steps: 'Restart nginx gagal. Cek log /var/log/nginx/error.log.',
    },
    {
      id: 'TK-002',
      title: 'Database server latency tinggi — query timeout',
      desc: 'Tim development melaporkan query ke PostgreSQL timeout setelah 30 detik. CPU DB server 92%. Mulai pukul 10.30 WIB.',
      priority: 'high',
      category: 'Database',
      serverId: 'srv_002',
      pic: 'Dedi / Tim DB',
      status: 'open',
      slaHours: 4,
      createdAt: now - 1000 * 60 * 20,
      updatedAt: now - 1000 * 60 * 20,
      comments: [],
      steps: '',
    },
    {
      id: 'TK-003',
      title: 'Sertifikat SSL mail server akan expire 7 hari lagi',
      desc: 'Alert dari monitoring: sertifikat SSL mail.company.com expire pada tanggal 28 November 2026. Perlu renewal segera.',
      priority: 'medium',
      category: 'Security',
      serverId: 'srv_003',
      pic: 'Tim Security',
      status: 'open',
      slaHours: 24,
      createdAt: now - 1000 * 60 * 60 * 3,
      updatedAt: now - 1000 * 60 * 60 * 3,
      comments: [],
      steps: 'Siapkan renewal via certbot / Let\'s Encrypt.',
    },
    {
      id: 'TK-004',
      title: 'Disk usage DNS server mencapai 88%',
      desc: 'Monitoring SNMP melaporkan disk /dev/sda1 pada ns1.company.com sudah 88%. Threshold warning 90%. Perlu cleanup.',
      priority: 'low',
      category: 'Server',
      serverId: 'srv_004',
      pic: 'Tim Infrastructure',
      status: 'resolved',
      slaHours: 24,
      createdAt: now - 1000 * 60 * 60 * 10,
      updatedAt: now - 1000 * 60 * 60 * 1,
      resolvedAt: now - 1000 * 60 * 60 * 1,
      comments: [
        { author: 'Admin', text: 'Cleanup log lama berhasil. Disk kembali ke 55%.', time: now - 1000 * 60 * 60 },
      ],
      steps: 'Hapus log /var/log/named/*.log lama.',
    },
  ];
}

/* ---- Storage ---- */
function getTickets() {
  const d = JSON.parse(localStorage.getItem(TK_KEY) || 'null');
  if (!d) { const def = defaultTickets(); localStorage.setItem(TK_KEY, JSON.stringify(def)); return def; }
  return d;
}
function saveTickets(list) { localStorage.setItem(TK_KEY, JSON.stringify(list)); }

/* ---- Helpers ---- */
function _e(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function tkNow() {
  return new Date().toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function fmtAge(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'baru saja';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' mnt lalu';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
  return Math.floor(diff / 86400000) + ' hari lalu';
}

function slaStatus(tk) {
  if (tk.status === 'resolved' || tk.status === 'closed') return 'ok';
  const elapsed = (Date.now() - tk.createdAt) / 3600000; // hours
  const pct     = elapsed / (tk.slaHours || 8);
  if (pct >= 1.0) return 'breach';
  if (pct >= 0.8) return 'warn';
  return 'ok';
}

function slaLabel(tk) {
  if (tk.status === 'resolved' || tk.status === 'closed') return 'SLA Met';
  const elapsed  = (Date.now() - tk.createdAt) / 3600000;
  const remaining = tk.slaHours - elapsed;
  if (remaining <= 0) return 'SLA BREACH';
  if (remaining < 1) return `${Math.round(remaining * 60)}m left`;
  return `${remaining.toFixed(1)}h left`;
}

function tkId() {
  const list = getTickets();
  const nums = list.map(t => parseInt(t.id.replace('TK-', '')) || 0);
  const next = Math.max(0, ...nums) + 1;
  return `TK-${String(next).padStart(3, '0')}`;
}

/* ---- Render ---- */
let _tkFilter   = 'all';
let _tkPriority = '';
let _tkSearch   = '';

function renderStats() {
  const list = getTickets();
  document.getElementById('tkTotal').textContent      = list.length;
  document.getElementById('tkOpen').textContent       = list.filter(t => t.status === 'open').length;
  document.getElementById('tkInProgress').textContent = list.filter(t => t.status === 'in-progress').length;
  document.getElementById('tkResolved').textContent   = list.filter(t => t.status === 'resolved' || t.status === 'closed').length;
}

function renderSLABar() {
  const list = getTickets();
  const open = list.filter(t => t.status === 'open' || t.status === 'in-progress');
  const breach = open.filter(t => slaStatus(t) === 'breach').length;
  const warn   = open.filter(t => slaStatus(t) === 'warn').length;
  const ok     = open.filter(t => slaStatus(t) === 'ok').length;
  const resolved = list.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  const bar = document.getElementById('tkSLABar');
  if (!bar) return;
  bar.innerHTML = `
    <div class="tk-sla-item">
      <span class="tk-sla-label">SLA Breach</span>
      <span class="tk-sla-value ${breach > 0 ? 'breach' : 'ok'}">${breach}</span>
    </div>
    <div class="tk-sla-item">
      <span class="tk-sla-label">SLA Warning</span>
      <span class="tk-sla-value ${warn > 0 ? 'warn' : 'ok'}">${warn}</span>
    </div>
    <div class="tk-sla-item">
      <span class="tk-sla-label">On Time</span>
      <span class="tk-sla-value ok">${ok}</span>
    </div>
    <div class="tk-sla-item">
      <span class="tk-sla-label">Resolved</span>
      <span class="tk-sla-value">${resolved}</span>
    </div>
    <div class="tk-sla-item" style="margin-left:auto;">
      <span class="tk-sla-label">Avg Resolution</span>
      <span class="tk-sla-value">${avgResolution(list)}</span>
    </div>
  `;
}

function avgResolution(list) {
  const resolved = list.filter(t => t.resolvedAt && t.createdAt);
  if (!resolved.length) return '—';
  const avg = resolved.reduce((a, t) => a + (t.resolvedAt - t.createdAt), 0) / resolved.length;
  const h   = avg / 3600000;
  if (h < 1) return Math.round(h * 60) + ' mnt';
  if (h < 24) return h.toFixed(1) + ' jam';
  return (h / 24).toFixed(1) + ' hari';
}

function filteredTickets() {
  let list = getTickets();
  if (_tkSearch) {
    const q = _tkSearch.toLowerCase();
    list = list.filter(t => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.pic || '').toLowerCase().includes(q));
  }
  if (_tkFilter !== 'all') list = list.filter(t => t.status === _tkFilter);
  if (_tkPriority) list = list.filter(t => t.priority === _tkPriority);
  return list;
}

function renderBoard() {
  const cols   = { 'open': [], 'in-progress': [], 'resolved': [], 'closed': [] };
  const list   = filteredTickets();
  list.forEach(t => {
    if (cols[t.status]) cols[t.status].push(t);
  });

  const colEmpty = document.getElementById('tkEmpty');
  if (!list.length && _tkFilter !== 'all') {
    colEmpty.style.display = '';
  } else {
    colEmpty.style.display = 'none';
  }

  const servers = getServers();
  Object.entries(cols).forEach(([status, tickets]) => {
    const container = document.getElementById(`cards-${status}`);
    const countEl   = document.getElementById(`colCount${status.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')}`);
    if (countEl) countEl.textContent = tickets.length;
    if (!container) return;

    container.innerHTML = tickets.length
      ? tickets.map(t => {
          const srv     = servers.find(s => s.id === t.serverId);
          const slaSt   = slaStatus(t);
          const slaLbl  = slaLabel(t);
          return `<div class="tk-card priority-${t.priority}" data-tkid="${t.id}">
            <div class="tk-card-id">${_e(t.id)} · ${fmtAge(t.createdAt)}</div>
            <div class="tk-card-title">${_e(t.title)}</div>
            <div class="tk-card-meta">
              <span class="tk-priority-pill ${t.priority}">${t.priority}</span>
              <span class="tk-category-pill">${_e(t.category)}</span>
              ${srv ? `<span class="tk-category-pill" style="color:var(--accent);">${_e(srv.name)}</span>` : ''}
            </div>
            <div class="tk-card-footer">
              <span>${_e(t.pic || 'Unassigned')}</span>
              <span class="tk-sla-indicator ${slaSt}">${slaLbl}</span>
            </div>
          </div>`;
        }).join('')
      : `<div style="padding:1rem;text-align:center;color:var(--text-dim);font-size:.78rem;">Tidak ada tiket</div>`;
  });
}

function renderMTR() {
  const list     = getTickets();
  const all      = list.length;
  const breach   = list.filter(t => { const s = slaStatus(t); return s === 'breach'; }).length;
  const critical = list.filter(t => t.priority === 'critical').length;
  const avgRes   = avgResolution(list);

  const grid = document.getElementById('tkMTRGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="tk-mtr-card">
      <div class="tk-mtr-label">Total Tiket</div>
      <div class="tk-mtr-value">${all}</div>
      <div class="tk-mtr-sub">semua waktu</div>
    </div>
    <div class="tk-mtr-card">
      <div class="tk-mtr-label">Critical Incidents</div>
      <div class="tk-mtr-value" style="color:var(--red);">${critical}</div>
      <div class="tk-mtr-sub">prioritas critical</div>
    </div>
    <div class="tk-mtr-card">
      <div class="tk-mtr-label">SLA Breached</div>
      <div class="tk-mtr-value" style="color:${breach > 0 ? 'var(--red)' : 'var(--green)'};">${breach}</div>
      <div class="tk-mtr-sub">tiket melewati SLA</div>
    </div>
    <div class="tk-mtr-card">
      <div class="tk-mtr-label">Avg Resolution Time</div>
      <div class="tk-mtr-value" style="font-size:1.1rem;padding-top:.2rem;">${avgRes}</div>
      <div class="tk-mtr-sub">Mean Time to Resolve</div>
    </div>
    <div class="tk-mtr-card">
      <div class="tk-mtr-label">Resolution Rate</div>
      <div class="tk-mtr-value" style="color:var(--green);">
        ${all ? Math.round(list.filter(t => t.status === 'resolved' || t.status === 'closed').length / all * 100) : 0}%
      </div>
      <div class="tk-mtr-sub">tiket diselesaikan</div>
    </div>
  `;
}

function fullRenderTK() {
  renderStats();
  renderSLABar();
  renderBoard();
  renderMTR();
}

/* ---- Ticket modal ---- */
function populateServerSelect(currentServerId = '') {
  const sel = document.getElementById('tkAssignedServer');
  if (!sel) return;
  // Clear existing options (keep first blank)
  while (sel.options.length > 1) sel.remove(1);
  getServers().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.ip})`;
    if (s.id === currentServerId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openTKModal(id = null) {
  const title = document.getElementById('tkModalTitle');
  const submit = document.getElementById('tkFormSubmit');
  title.textContent   = id ? 'Edit Tiket' : 'Buat Tiket Insiden';
  submit.textContent  = id ? 'Simpan Perubahan' : 'Buat Tiket';
  document.getElementById('tkEditId').value = id || '';

  if (id) {
    const tk = getTickets().find(t => t.id === id);
    if (!tk) return;
    document.getElementById('tkTitle').value    = tk.title;
    document.getElementById('tkDesc').value     = tk.desc;
    document.getElementById('tkPriority').value = tk.priority;
    document.getElementById('tkCategory').value = tk.category;
    document.getElementById('tkPIC').value       = tk.pic || '';
    document.getElementById('tkStatus').value    = tk.status;
    document.getElementById('tkSLA').value       = String(tk.slaHours || 8);
    document.getElementById('tkSteps').value     = tk.steps || '';
    populateServerSelect(tk.serverId);
  } else {
    document.getElementById('tkForm').reset();
    populateServerSelect('');
  }
  document.getElementById('tkModalOverlay').classList.add('open');
}

function closeTKModal() { document.getElementById('tkModalOverlay').classList.remove('open'); }

/* ---- Detail modal ---- */
function openTKDetail(id) {
  const list   = getTickets();
  const tk     = list.find(t => t.id === id);
  if (!tk) return;
  const servers = getServers();
  const srv     = servers.find(s => s.id === tk.serverId);

  document.getElementById('tkDetailTitle').textContent = `${tk.id} — ${tk.title}`;

  const comments = tk.comments || [];

  document.getElementById('tkDetailBody').innerHTML = `
    <div class="tk-detail-section">
      <div class="tk-detail-section-title">Info Tiket</div>
      <table class="detail-table">
        <tr><th>Prioritas</th><td><span class="tk-priority-pill ${tk.priority}">${tk.priority}</span></td></tr>
        <tr><th>Kategori</th><td>${_e(tk.category)}</td></tr>
        <tr><th>Status</th><td>
          <div class="tk-status-select-wrap">
            <select id="tkDetailStatus">
              <option value="open" ${tk.status==='open'?'selected':''}>Open</option>
              <option value="in-progress" ${tk.status==='in-progress'?'selected':''}>In Progress</option>
              <option value="resolved" ${tk.status==='resolved'?'selected':''}>Resolved</option>
              <option value="closed" ${tk.status==='closed'?'selected':''}>Closed</option>
            </select>
            <button class="btn-primary" id="btnTKUpdateStatus" data-id="${id}" style="font-size:.78rem;padding:.35rem .8rem;">Update</button>
          </div>
        </td></tr>
        <tr><th>Server</th><td>${srv ? `<span class="type-badge">${_e(srv.name)}</span> ${_e(srv.ip)}` : '—'}</td></tr>
        <tr><th>PIC</th><td>${_e(tk.pic || 'Unassigned')}</td></tr>
        <tr><th>SLA Target</th><td>${tk.slaHours} jam · <span class="tk-sla-indicator ${slaStatus(tk)}">${slaLabel(tk)}</span></td></tr>
        <tr><th>Dibuat</th><td>${new Date(tk.createdAt).toLocaleString('id-ID')}</td></tr>
        ${tk.resolvedAt ? `<tr><th>Diselesaikan</th><td>${new Date(tk.resolvedAt).toLocaleString('id-ID')}</td></tr>` : ''}
      </table>
    </div>

    <div class="tk-detail-section">
      <div class="tk-detail-section-title">Deskripsi</div>
      <div style="font-size:.84rem;color:var(--text-muted);line-height:1.65;white-space:pre-wrap;">${_e(tk.desc)}</div>
    </div>

    ${tk.steps ? `<div class="tk-detail-section">
      <div class="tk-detail-section-title">Langkah Penanganan</div>
      <div style="font-size:.82rem;color:var(--text-muted);line-height:1.65;white-space:pre-wrap;">${_e(tk.steps)}</div>
    </div>` : ''}

    <div class="tk-detail-section">
      <div class="tk-detail-section-title">Komentar & Update (${comments.length})</div>
      <div class="tk-comment-list" id="tkCommentList">
        ${comments.length
          ? comments.map(c => `<div class="tk-comment">
              <div class="tk-comment-meta">${_e(c.author)} · ${new Date(c.time).toLocaleString('id-ID')}</div>
              <div class="tk-comment-text">${_e(c.text)}</div>
            </div>`).join('')
          : '<div style="color:var(--text-dim);font-size:.8rem;padding:.5rem 0;">Belum ada komentar.</div>'}
      </div>
      <div class="tk-comment-add">
        <textarea id="tkNewComment" rows="2" placeholder="Tambahkan update / komentar..."></textarea>
        <button class="btn-primary" id="btnAddComment" data-id="${id}" style="font-size:.78rem;padding:.5rem .9rem;white-space:nowrap;">
          + Kirim
        </button>
      </div>
    </div>

    <div class="form-actions" style="margin-top:.5rem;">
      <button class="btn-secondary" id="btnTKEdit" data-id="${id}">✎ Edit</button>
      <button class="btn-primary" style="background:var(--red);" id="btnTKDelete" data-id="${id}">✕ Hapus</button>
    </div>
  `;

  // Status update
  document.getElementById('btnTKUpdateStatus')?.addEventListener('click', () => {
    const newStatus = document.getElementById('tkDetailStatus').value;
    const tks = getTickets();
    const idx = tks.findIndex(t => t.id === id);
    if (idx < 0) return;
    tks[idx].status    = newStatus;
    tks[idx].updatedAt = Date.now();
    if (newStatus === 'resolved' || newStatus === 'closed') tks[idx].resolvedAt = Date.now();
    saveTickets(tks);
    fullRenderTK();
    if (typeof showToast === 'function') showToast(`Status tiket ${id} diperbarui ke "${newStatus}".`, 'success');
    if (typeof pushLog === 'function') pushLog('info', `Tiket ${id}: status → ${newStatus}`);
  });

  // Add comment
  document.getElementById('btnAddComment')?.addEventListener('click', () => {
    const text = document.getElementById('tkNewComment').value.trim();
    if (!text) return;
    const profile = typeof getProfile === 'function' ? getProfile() : { name: 'IT Ops' };
    const tks = getTickets();
    const idx = tks.findIndex(t => t.id === id);
    if (idx < 0) return;
    tks[idx].comments = tks[idx].comments || [];
    tks[idx].comments.push({ author: profile.name || 'IT Ops', text, time: Date.now() });
    tks[idx].updatedAt = Date.now();
    saveTickets(tks);
    document.getElementById('tkNewComment').value = '';
    // Re-render comment list
    const cl = document.getElementById('tkCommentList');
    if (cl) cl.innerHTML = tks[idx].comments.map(c => `<div class="tk-comment">
      <div class="tk-comment-meta">${_e(c.author)} · ${new Date(c.time).toLocaleString('id-ID')}</div>
      <div class="tk-comment-text">${_e(c.text)}</div>
    </div>`).join('');
    fullRenderTK();
    if (typeof showToast === 'function') showToast('Komentar ditambahkan.', 'success');
  });

  // Edit button
  document.getElementById('btnTKEdit')?.addEventListener('click', () => {
    document.getElementById('tkDetailOverlay').classList.remove('open');
    openTKModal(id);
  });

  // Delete button
  document.getElementById('btnTKDelete')?.addEventListener('click', () => {
    const tk2 = getTickets().find(t => t.id === id);
    if (!confirm(`Hapus tiket ${id}?`)) return;
    saveTickets(getTickets().filter(t => t.id !== id));
    document.getElementById('tkDetailOverlay').classList.remove('open');
    fullRenderTK();
    if (typeof showToast === 'function') showToast(`Tiket ${id} dihapus.`, 'warning');
  });

  document.getElementById('tkDetailOverlay').classList.add('open');
}

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('tkBoard')) return;

  populateServerSelect();
  fullRenderTK();

  // SLA refresh every minute
  setInterval(() => { renderSLABar(); renderBoard(); }, 60000);

  // Filter buttons
  document.querySelectorAll('[data-tkfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tkfilter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _tkFilter = btn.dataset.tkfilter;
      renderBoard();
    });
  });

  // Priority quick filters
  document.querySelectorAll('[data-tkpriority]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (_tkPriority === btn.dataset.tkpriority) {
        _tkPriority = '';
        document.querySelectorAll('[data-tkpriority]').forEach(b => b.classList.remove('active'));
      } else {
        document.querySelectorAll('[data-tkpriority]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _tkPriority = btn.dataset.tkpriority;
      }
      renderBoard();
    });
  });

  // Search
  document.getElementById('tkSearch').addEventListener('input', e => {
    _tkSearch = e.target.value.trim();
    renderBoard();
  });

  // New ticket
  document.getElementById('btnNewTicket').addEventListener('click', () => openTKModal());
  document.getElementById('tkModalClose').addEventListener('click', closeTKModal);
  document.getElementById('tkFormCancel').addEventListener('click', closeTKModal);
  document.getElementById('tkModalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('tkModalOverlay')) closeTKModal();
  });

  // Detail close
  document.getElementById('tkDetailClose').addEventListener('click', () => {
    document.getElementById('tkDetailOverlay').classList.remove('open');
  });
  document.getElementById('tkDetailOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('tkDetailOverlay'))
      document.getElementById('tkDetailOverlay').classList.remove('open');
  });

  // Form submit
  document.getElementById('tkForm').addEventListener('submit', e => {
    e.preventDefault();
    const id      = document.getElementById('tkEditId').value;
    const title   = document.getElementById('tkTitle').value.trim();
    const desc    = document.getElementById('tkDesc').value.trim();
    const priority = document.getElementById('tkPriority').value;
    const category = document.getElementById('tkCategory').value;
    const serverId = document.getElementById('tkAssignedServer').value;
    const pic     = document.getElementById('tkPIC').value.trim();
    const status  = document.getElementById('tkStatus').value;
    const slaHours = parseInt(document.getElementById('tkSLA').value) || 8;
    const steps   = document.getElementById('tkSteps').value.trim();

    document.getElementById('tkErrTitle').textContent = '';
    document.getElementById('tkErrDesc').textContent  = '';

    let valid = true;
    if (!title) { document.getElementById('tkErrTitle').textContent = 'Judul wajib diisi.'; valid = false; }
    if (!desc)  { document.getElementById('tkErrDesc').textContent  = 'Deskripsi wajib diisi.'; valid = false; }
    if (!valid) return;

    const list = getTickets();
    if (id) {
      const idx = list.findIndex(t => t.id === id);
      if (idx >= 0) list[idx] = { ...list[idx], title, desc, priority, category, serverId, pic, status, slaHours, steps, updatedAt: Date.now() };
    } else {
      const newTK = {
        id: tkId(), title, desc, priority, category, serverId, pic, status, slaHours, steps,
        createdAt: Date.now(), updatedAt: Date.now(), comments: [],
      };
      list.push(newTK);
      if (typeof pushLog === 'function') pushLog(priority === 'critical' ? 'offline' : 'warning', `Tiket baru: ${newTK.id} — ${title}`);
    }
    saveTickets(list);
    fullRenderTK();
    closeTKModal();
    if (typeof showToast === 'function') showToast(id ? 'Tiket diperbarui.' : 'Tiket baru dibuat.', 'success');
  });

  // Click on ticket card → open detail
  document.getElementById('tkBoard').addEventListener('click', e => {
    const card = e.target.closest('.tk-card');
    if (card && card.dataset.tkid) openTKDetail(card.dataset.tkid);
  });
});
