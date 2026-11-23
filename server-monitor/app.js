/* ============================================================
   ServerWatch — app.js
   Shared logic for dashboard (index.html) and profile (profile.html)
   ============================================================ */

'use strict';

/* ------------------------------------------------------------------ */
/*  Constants & Defaults                                                */
/* ------------------------------------------------------------------ */
const STORAGE_KEYS = {
  servers:  'sw_servers',
  profile:  'sw_profile',
  log:      'sw_log',
};

const DEFAULT_SERVERS = [
  {
    id: 'srv_001',
    name: 'Web Server Utama',
    domain: 'web.company.com',
    ip: '192.168.1.10',
    type: 'Web',
    os: 'Ubuntu 22.04 LTS',
    location: 'DC Jakarta Rack-A1',
    notes: 'Server produksi utama untuk layanan web perusahaan.',
    addedAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
  },
  {
    id: 'srv_002',
    name: 'Database Server',
    domain: 'db.company.com',
    ip: '192.168.1.20',
    type: 'Database',
    os: 'CentOS 7',
    location: 'DC Jakarta Rack-A2',
    notes: 'Primary PostgreSQL & Redis instance.',
    addedAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
  },
  {
    id: 'srv_003',
    name: 'Mail Server',
    domain: 'mail.company.com',
    ip: '192.168.1.30',
    type: 'Mail',
    os: 'Debian 11',
    location: 'DC Surabaya Rack-B1',
    notes: 'Postfix + Dovecot mail server.',
    addedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: 'srv_004',
    name: 'DNS Server',
    domain: 'ns1.company.com',
    ip: '8.8.8.8',
    type: 'DNS',
    os: 'Ubuntu 20.04 LTS',
    location: 'DC Jakarta Rack-A3',
    notes: 'Bind9 authoritative DNS server.',
    addedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 'srv_005',
    name: 'App Server Staging',
    domain: 'staging.company.com',
    ip: '192.168.2.10',
    type: 'App',
    os: 'Ubuntu 22.04 LTS',
    location: 'DC Jakarta Rack-B4',
    notes: 'Environment staging untuk QA testing.',
    addedAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
  },
];

const DEFAULT_PROFILE = {
  name: 'IT Ops Engineer',
  username: 'itops',
  email: 'itops@company.internal',
  division: 'Infrastructure & Operations',
  bio: 'Bertanggung jawab atas pengelolaan dan pemantauan infrastruktur server perusahaan.',
  initials: 'IT',
};

/* ------------------------------------------------------------------ */
/*  Utilities                                                           */
/* ------------------------------------------------------------------ */
function uid() {
  return 'srv_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function now() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function elapsed(ts) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 36e5);
  const d = Math.floor(h / 24);
  if (d > 0) return d + ' hari';
  if (h > 0) return h + ' jam';
  return Math.floor(diff / 60000) + ' menit';
}

/* Simulate ping — returns ms value. Offline servers return -1. */
function simulatePing(serverId, forceOffline = false) {
  if (forceOffline) return -1;
  // Deterministic-ish seed so the same server has consistent "behaviour"
  const seed = serverId.charCodeAt(serverId.length - 1);
  const base  = 5 + (seed % 3) * 40;        // 5–125 ms
  const jitter = (Math.random() * 60) - 15;  // ±15 ms
  const ms = Math.round(base + jitter);
  // 8% chance of a spike
  if (Math.random() < 0.08) return Math.round(ms * 4 + Math.random() * 100);
  // 5% chance of timeout
  if (Math.random() < 0.05) return -1;
  return Math.max(1, ms);
}

function pingStatus(ms) {
  if (ms < 0)   return 'offline';
  if (ms < 100) return 'online';
  if (ms < 300) return 'warning';
  return 'offline';
}

function pingClass(ms) {
  if (ms < 0)   return 'bad';
  if (ms < 100) return 'good';
  if (ms < 300) return 'medium';
  return 'bad';
}

function pingLabel(ms) {
  if (ms < 0) return 'Timeout';
  return ms + ' ms';
}

function pingBarWidth(ms) {
  if (ms < 0)   return 100;
  if (ms < 100) return Math.max(8, (ms / 100) * 40 + 8);
  if (ms < 300) return 40 + ((ms - 100) / 200) * 40;
  return 100;
}

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                     */
/* ------------------------------------------------------------------ */
const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
};

function getServers() {
  const list = store.get(STORAGE_KEYS.servers);
  if (!list || list.length === 0) {
    store.set(STORAGE_KEYS.servers, DEFAULT_SERVERS);
    return DEFAULT_SERVERS.map(s => ({ ...s }));
  }
  return list;
}

function saveServers(list) { store.set(STORAGE_KEYS.servers, list); }

function getProfile() {
  return store.get(STORAGE_KEYS.profile) || { ...DEFAULT_PROFILE };
}

function saveProfile(p) { store.set(STORAGE_KEYS.profile, p); }

function getLogs() {
  return store.get(STORAGE_KEYS.log) || [];
}

function saveLogs(logs) {
  store.set(STORAGE_KEYS.log, logs.slice(0, 200)); // keep latest 200
}

function pushLog(type, message) {
  const logs = getLogs();
  logs.unshift({ type, message, time: now(), ts: Date.now() });
  saveLogs(logs);
}

/* ------------------------------------------------------------------ */
/*  Shared: Sidebar toggle, Clock, Toast                               */
/* ------------------------------------------------------------------ */
function initShared() {
  // Sidebar toggle
  const sidebar  = document.getElementById('sidebar');
  const wrapper  = document.querySelector('.main-wrapper');
  const btnToggle = document.getElementById('toggleSidebar');

  if (btnToggle && sidebar) {
    btnToggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
      } else {
        const collapsed = sidebar.classList.toggle('collapsed');
        wrapper && wrapper.classList.toggle('expanded', collapsed);
      }
    });
  }

  // Live clock
  const clockEl = document.getElementById('liveClock');
  if (clockEl) {
    const tick = () => {
      const d = new Date();
      clockEl.textContent = d.toLocaleString('id-ID', {
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  // Sync profile name in sidebar
  const p = getProfile();
  const sidebarName   = document.getElementById('sidebarName');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarName)   sidebarName.textContent   = p.name || 'IT Ops';
  if (sidebarAvatar) sidebarAvatar.textContent  = p.initials || 'IT';
}

/* Toast helper */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✔', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

/* ------------------------------------------------------------------ */
/*  Dashboard Page                                                      */
/* ------------------------------------------------------------------ */
function initDashboard() {
  if (!document.getElementById('serverTbody')) return;

  /* Runtime ping state */
  const pingState = {}; // { [id]: { ms, history: [] } }

  function getOrInitPing(id) {
    if (!pingState[id]) {
      const ms = simulatePing(id);
      pingState[id] = { ms, history: Array.from({ length: 10 }, () => simulatePing(id)) };
    }
    return pingState[id];
  }

  /* Refresh individual server ping */
  function refreshPing(id) {
    const ms = simulatePing(id);
    const ps  = getOrInitPing(id);
    ps.history.push(ms);
    if (ps.history.length > 20) ps.history.shift();
    ps.ms = ms;

    const prev = pingState[id].prevStatus;
    const curr = pingStatus(ms);
    if (prev && prev !== curr) {
      const servers = getServers();
      const srv = servers.find(s => s.id === id);
      const name = srv ? srv.name : id;
      if (curr === 'offline') {
        pushLog('offline', `${name} tidak merespons (timeout).`);
        showToast(`${name} tidak merespons!`, 'error');
      } else if (prev === 'offline') {
        pushLog('online', `${name} kembali online — ${ms} ms.`);
        showToast(`${name} kembali online.`, 'success');
      } else if (curr === 'warning') {
        pushLog('warning', `${name} latensi tinggi: ${ms} ms.`);
      }
    }
    pingState[id].prevStatus = curr;
    return ms;
  }

  /* Build/update stats */
  function updateStats(servers, pings) {
    const total   = servers.length;
    const online  = servers.filter(s => pingStatus(pings[s.id]) === 'online').length;
    const offline = servers.filter(s => pingStatus(pings[s.id]) === 'offline').length;
    const warning = servers.filter(s => pingStatus(pings[s.id]) === 'warning').length;
    document.getElementById('statTotal').textContent   = total;
    document.getElementById('statOnline').textContent  = online;
    document.getElementById('statOffline').textContent = offline;
    document.getElementById('statWarning').textContent = warning;
  }

  /* Build table rows */
  function buildRows(servers) {
    const tbody = document.getElementById('serverTbody');
    const empty = document.getElementById('emptyState');

    if (!servers.length) {
      tbody.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = '';
    servers.forEach((srv, idx) => {
      const ps = getOrInitPing(srv.id);
      const ms  = ps.ms;
      const st  = pingStatus(ms);
      const cls = pingClass(ms);
      const bw  = pingBarWidth(ms);

      const tr = document.createElement('tr');
      tr.dataset.id     = srv.id;
      tr.dataset.status = st;

      tr.innerHTML = `
        <td class="td-num">${idx + 1}</td>
        <td>
          <div class="cell-name">
            <span class="srv-name">${esc(srv.name)}</span>
            <span class="srv-os">${esc(srv.os || '—')}</span>
          </div>
        </td>
        <td>${esc(srv.domain)}</td>
        <td style="font-variant-numeric:tabular-nums;font-size:.82rem;">${esc(srv.ip)}</td>
        <td><span class="type-badge">${esc(srv.type)}</span></td>
        <td>
          <span class="status-badge ${st}">
            <span class="pulse"></span>
            ${stLabel(st)}
          </span>
        </td>
        <td>
          <div class="ping-cell">
            <span class="ping-val ${cls}">${pingLabel(ms)}</span>
            <div class="ping-bar"><div class="ping-fill ${cls}" style="width:${bw}%"></div></div>
          </div>
        </td>
        <td><span class="uptime-val">${elapsed(srv.addedAt)}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn-icon btn-ping" data-id="${srv.id}" title="Ping sekarang">↺</button>
            <button class="btn-icon btn-detail" data-id="${srv.id}" title="Detail server">⊙</button>
            <button class="btn-icon btn-delete" data-id="${srv.id}" title="Hapus server">✕</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Current ping map for stats
    const pings = {};
    servers.forEach(s => { pings[s.id] = getOrInitPing(s.id).ms; });
    updateStats(servers, pings);
  }

  /* Partial row update (no full re-render) */
  function updateRow(id) {
    const ms  = pingState[id] ? pingState[id].ms : simulatePing(id);
    const st  = pingStatus(ms);
    const cls = pingClass(ms);
    const bw  = pingBarWidth(ms);
    const tr  = document.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
    tr.dataset.status = st;
    const badge = tr.querySelector('.status-badge');
    if (badge) {
      badge.className = `status-badge ${st}`;
      badge.innerHTML = `<span class="pulse"></span>${stLabel(st)}`;
    }
    const pv = tr.querySelector('.ping-val');
    if (pv) { pv.className = `ping-val ${cls}`; pv.textContent = pingLabel(ms); }
    const pf = tr.querySelector('.ping-fill');
    if (pf) { pf.className = `ping-fill ${cls}`; pf.style.width = bw + '%'; }

    // stats
    const servers = getServers();
    const pings = {};
    servers.forEach(s => { pings[s.id] = getOrInitPing(s.id).ms; });
    updateStats(servers, pings);
  }

  function stLabel(st) {
    if (st === 'online')  return 'Online';
    if (st === 'offline') return 'Offline';
    if (st === 'warning') return 'Warning';
    return 'Checking…';
  }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
    }[c]));
  }

  /* Filter & search */
  let activeFilter = 'all';
  let searchTerm   = '';

  function filteredServers() {
    let list = getServers();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.ip.toLowerCase().includes(q) ||
        (s.type || '').toLowerCase().includes(q)
      );
    }
    if (activeFilter !== 'all') {
      list = list.filter(s => {
        const ps = getOrInitPing(s.id);
        return pingStatus(ps.ms) === activeFilter;
      });
    }
    return list;
  }

  function render() {
    buildRows(filteredServers());
    renderLog();
    document.getElementById('lastUpdated').textContent = now();
  }

  /* Log renderer */
  function renderLog() {
    const logEl = document.getElementById('activityLog');
    if (!logEl) return;
    const logs = getLogs();
    if (!logs.length) {
      logEl.innerHTML = '<div class="log-empty">Belum ada aktivitas tercatat.</div>';
      return;
    }
    logEl.innerHTML = logs.slice(0, 50).map(l => `
      <div class="log-entry">
        <span class="log-time">${l.time}</span>
        <span class="log-dot ${l.type}"></span>
        <span class="log-msg">${esc(l.message)}</span>
      </div>
    `).join('');
  }

  /* Detail modal */
  function openDetailModal(id) {
    const servers = getServers();
    const srv = servers.find(s => s.id === id);
    if (!srv) return;
    const ps  = getOrInitPing(id);
    const ms  = ps.ms;
    const st  = pingStatus(ms);

    document.getElementById('modalTitle').textContent = srv.name;

    // Build history bars
    const history = ps.history || [];
    const maxMs = Math.max(...history.map(v => v < 0 ? 300 : v), 1);
    const bars = history.map(v => {
      const h   = v < 0 ? 30 : Math.max(4, Math.round((v / maxMs) * 60));
      const cls = v < 0 ? 'bad' : pingClass(v);
      return `<div class="ping-bar-v ${cls}" style="height:${h}px;" title="${v < 0 ? 'Timeout' : v + ' ms'}"></div>`;
    }).join('');

    document.getElementById('modalBody').innerHTML = `
      <table class="detail-table">
        <tr><th>Nama Server</th><td>${esc(srv.name)}</td></tr>
        <tr><th>Domain</th><td>${esc(srv.domain)}</td></tr>
        <tr><th>IP Address</th><td>${esc(srv.ip)}</td></tr>
        <tr><th>Jenis</th><td><span class="type-badge">${esc(srv.type)}</span></td></tr>
        <tr><th>Sistem Operasi</th><td>${esc(srv.os || '—')}</td></tr>
        <tr><th>Lokasi / Rack</th><td>${esc(srv.location || '—')}</td></tr>
        <tr><th>Status</th><td><span class="status-badge ${st}"><span class="pulse"></span>${stLabel(st)}</span></td></tr>
        <tr><th>Ping Terakhir</th><td class="ping-val ${pingClass(ms)}">${pingLabel(ms)}</td></tr>
        <tr><th>Ditambahkan</th><td>${fmtDate(srv.addedAt)}</td></tr>
        ${srv.notes ? `<tr><th>Catatan</th><td style="font-style:italic;color:var(--text-muted)">${esc(srv.notes)}</td></tr>` : ''}
      </table>
      <div style="margin-top:1rem;">
        <div style="font-size:.78rem;color:var(--text-dim);margin-bottom:.4rem;">Riwayat ping (${history.length} data terakhir)</div>
        <div class="ping-history">${bars}</div>
        <div class="ping-history-label">← terlama &nbsp;&nbsp; terbaru →</div>
      </div>
    `;
    document.getElementById('modalOverlay').classList.add('open');
  }

  /* Delete server */
  function deleteServer(id) {
    const servers = getServers();
    const srv = servers.find(s => s.id === id);
    if (!srv) return;
    if (!confirm(`Hapus server "${srv.name}" dari daftar?`)) return;
    const updated = servers.filter(s => s.id !== id);
    saveServers(updated);
    pushLog('info', `Server "${srv.name}" dihapus dari daftar.`);
    showToast(`Server "${srv.name}" dihapus.`, 'warning');
    render();
  }

  /* Event: table actions (delegated) */
  document.getElementById('serverTbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('btn-ping')) {
      btn.textContent = '…';
      btn.disabled = true;
      setTimeout(() => {
        refreshPing(id);
        btn.textContent = '↺';
        btn.disabled = false;
        updateRow(id);
        pushLog('info', `Manual ping ke ${id}: ${pingLabel(pingState[id].ms)}`);
        showToast('Ping selesai.', 'success');
      }, 600 + Math.random() * 400);
    }

    if (btn.classList.contains('btn-detail')) openDetailModal(id);
    if (btn.classList.contains('btn-delete')) deleteServer(id);
  });

  /* Event: filter buttons */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  /* Event: search */
  document.getElementById('searchInput').addEventListener('input', e => {
    searchTerm = e.target.value.trim();
    render();
  });

  /* Event: refresh all */
  document.getElementById('btnRefreshAll').addEventListener('click', () => {
    const servers = getServers();
    servers.forEach(s => refreshPing(s.id));
    render();
    showToast('Semua server di-refresh.', 'info');
    pushLog('info', 'Refresh manual semua server.');
  });

  /* Event: close modal */
  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.remove('open');
  });
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay'))
      document.getElementById('modalOverlay').classList.remove('open');
  });

  /* Event: clear log */
  document.getElementById('btnClearLog').addEventListener('click', () => {
    saveLogs([]);
    renderLog();
    showToast('Log aktivitas dibersihkan.', 'info');
  });

  /* Auto-refresh every 15 seconds */
  setInterval(() => {
    const servers = getServers();
    servers.forEach(s => refreshPing(s.id));
    render();
  }, 15000);

  // Initial render
  render();
  pushLog('info', 'Dashboard dimuat. Memulai pemantauan server.');
}

/* ------------------------------------------------------------------ */
/*  Profile Page                                                        */
/* ------------------------------------------------------------------ */
function initProfile() {
  if (!document.getElementById('profileAvatar')) return;

  const profile = getProfile();

  /* Populate profile fields */
  function populateProfile(p) {
    const fields = ['displayName','displayUsername','displayEmail','displayDivision','displayBio'];
    const keys   = ['name','username','email','division','bio'];
    fields.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = p[keys[i]] || '—';
    });
    const avatarEl       = document.getElementById('profileAvatar');
    const sidebarAvatar  = document.getElementById('sidebarAvatar');
    const sidebarNameEl  = document.getElementById('sidebarName');
    if (avatarEl)      avatarEl.textContent      = p.initials || 'IT';
    if (sidebarAvatar) sidebarAvatar.textContent  = p.initials || 'IT';
    if (sidebarNameEl) sidebarNameEl.textContent  = p.name || 'IT Ops';
  }
  populateProfile(profile);

  /* Edit profile modal */
  const modalOverlay = document.getElementById('modalOverlay');
  const modalBody    = document.getElementById('modalBody');
  const modalClose   = document.getElementById('modalClose');

  function openEditModal(fieldKey, label, currentVal, multiline = false) {
    document.getElementById('modalTitle').textContent = `Edit ${label}`;
    modalBody.innerHTML = `
      <div class="edit-field-wrap">
        <label>${label}</label>
        ${multiline
          ? `<textarea id="editInput" rows="3">${esc(currentVal)}</textarea>`
          : `<input type="text" id="editInput" value="${esc(currentVal)}" />`
        }
      </div>
      <div class="edit-modal-actions">
        <button class="btn-secondary" id="editCancelBtn">Batal</button>
        <button class="btn-primary" id="editSaveBtn">Simpan</button>
      </div>
    `;
    modalOverlay.classList.add('open');
    const inp = document.getElementById('editInput');
    inp.focus();
    if (inp.tagName === 'INPUT') inp.select();

    document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
    document.getElementById('editSaveBtn').addEventListener('click', () => {
      const val = inp.value.trim();
      if (!val) { showToast('Nilai tidak boleh kosong.', 'error'); return; }
      const p = getProfile();
      p[fieldKey] = val;
      // Auto-compute initials from name
      if (fieldKey === 'name') {
        const parts = val.trim().split(/\s+/);
        p.initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : val.slice(0, 2).toUpperCase();
      }
      saveProfile(p);
      populateProfile(p);
      closeEditModal();
      showToast(`${label} berhasil diperbarui.`, 'success');
    });
  }

  function closeEditModal() {
    modalOverlay.classList.remove('open');
  }

  modalClose.addEventListener('click', closeEditModal);
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeEditModal();
  });

  /* Edit buttons */
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const field  = btn.dataset.field;
      const el     = document.getElementById(target);
      const val    = el ? el.textContent : '';
      const labels = { name:'Nama Lengkap', username:'Username', email:'Email', division:'Divisi', bio:'Deskripsi' };
      openEditModal(field, labels[field] || field, val, field === 'bio');
    });
  });

  /* Change avatar initials */
  document.getElementById('btnChangeAvatar').addEventListener('click', () => {
    const p = getProfile();
    openEditModal('initials', 'Inisial Avatar (maks 2 huruf)', p.initials || 'IT');
  });

  /* ---------------------------------------------------------------- */
  /*  Add Server Form                                                   */
  /* ---------------------------------------------------------------- */
  const addFormWrap = document.getElementById('addFormWrap');
  const btnToggle   = document.getElementById('btnToggleForm');
  const btnCancel   = document.getElementById('btnCancelForm');
  const addForm     = document.getElementById('addServerForm');

  btnToggle.addEventListener('click', () => {
    const open = addFormWrap.style.display === '' || addFormWrap.style.display === 'flex';
    addFormWrap.style.display = open ? 'none' : 'block';
    btnToggle.textContent = open ? '+ Tambah Server' : '— Tutup Form';
  });
  btnCancel.addEventListener('click', () => {
    addFormWrap.style.display = 'none';
    btnToggle.textContent = '+ Tambah Server';
    addForm.reset();
    clearFormErrors();
  });

  function clearFormErrors() {
    ['errName','errDomain','errIP','errType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  function validateIPv4(ip) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
      ip.split('.').every(n => parseInt(n) <= 255);
  }

  function validateDomain(d) {
    return /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(d);
  }

  addForm.addEventListener('submit', e => {
    e.preventDefault();
    clearFormErrors();

    const name   = document.getElementById('fName').value.trim();
    const domain = document.getElementById('fDomain').value.trim();
    const ip     = document.getElementById('fIP').value.trim();
    const type   = document.getElementById('fType').value;
    const loc    = document.getElementById('fLocation').value.trim();
    const os     = document.getElementById('fOS').value.trim();
    const notes  = document.getElementById('fNotes').value.trim();

    let valid = true;
    if (!name) {
      document.getElementById('errName').textContent = 'Nama server wajib diisi.';
      valid = false;
    }
    if (!domain) {
      document.getElementById('errDomain').textContent = 'Domain wajib diisi.';
      valid = false;
    } else if (!validateDomain(domain)) {
      document.getElementById('errDomain').textContent = 'Format domain tidak valid.';
      valid = false;
    }
    if (!ip) {
      document.getElementById('errIP').textContent = 'IP address wajib diisi.';
      valid = false;
    } else if (!validateIPv4(ip)) {
      document.getElementById('errIP').textContent = 'Format IP tidak valid (cth: 192.168.1.1).';
      valid = false;
    }
    if (!type) {
      document.getElementById('errType').textContent = 'Jenis server wajib dipilih.';
      valid = false;
    }
    if (!valid) return;

    const servers = getServers();
    // Duplicate IP check
    if (servers.some(s => s.ip === ip)) {
      document.getElementById('errIP').textContent = 'IP address sudah terdaftar.';
      return;
    }

    const newServer = {
      id: uid(),
      name, domain, ip, type,
      location: loc, os, notes,
      addedAt: Date.now(),
    };
    servers.push(newServer);
    saveServers(servers);
    pushLog('info', `Server baru ditambahkan: "${name}" (${ip}).`);
    showToast(`Server "${name}" berhasil ditambahkan!`, 'success');
    addForm.reset();
    addFormWrap.style.display = 'none';
    btnToggle.textContent = '+ Tambah Server';
    renderServerCards();
  });

  /* ---------------------------------------------------------------- */
  /*  Server Cards                                                      */
  /* ---------------------------------------------------------------- */
  function renderServerCards() {
    const cards   = document.getElementById('serverCards');
    const emptyEl = document.getElementById('emptyStateProfile');
    const servers = getServers();

    if (!servers.length) {
      cards.innerHTML = '';
      emptyEl.style.display = '';
      return;
    }
    emptyEl.style.display = 'none';

    // We don't have live ping on profile page — show neutral status
    cards.innerHTML = servers.map(srv => `
      <div class="server-card" data-id="${srv.id}">
        <div class="card-top">
          <span class="card-name">${esc(srv.name)}</span>
          <div class="card-actions">
            <button class="btn-icon btn-edit-srv" data-id="${srv.id}" title="Edit server">✎</button>
            <button class="btn-icon btn-delete-srv" data-id="${srv.id}" title="Hapus server">✕</button>
          </div>
        </div>
        <div class="card-meta">
          <div class="meta-row">
            <span class="meta-label">Domain</span>
            <span class="meta-val">${esc(srv.domain)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">IP</span>
            <span class="meta-val" style="font-variant-numeric:tabular-nums;">${esc(srv.ip)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Jenis</span>
            <span class="type-badge">${esc(srv.type)}</span>
          </div>
          ${srv.os ? `<div class="meta-row"><span class="meta-label">OS</span><span class="meta-val">${esc(srv.os)}</span></div>` : ''}
          ${srv.location ? `<div class="meta-row"><span class="meta-label">Lokasi</span><span class="meta-val">${esc(srv.location)}</span></div>` : ''}
          <div class="meta-row">
            <span class="meta-label">Ditambahkan</span>
            <span class="meta-val">${fmtDate(srv.addedAt)}</span>
          </div>
        </div>
        ${srv.notes ? `<div class="card-notes">${esc(srv.notes)}</div>` : ''}
      </div>
    `).join('');

    // Events on cards
    cards.querySelectorAll('.btn-delete-srv').forEach(btn => {
      btn.addEventListener('click', () => deleteServerProfile(btn.dataset.id));
    });
    cards.querySelectorAll('.btn-edit-srv').forEach(btn => {
      btn.addEventListener('click', () => openEditServerModal(btn.dataset.id));
    });
  }

  function deleteServerProfile(id) {
    const servers = getServers();
    const srv = servers.find(s => s.id === id);
    if (!srv) return;
    if (!confirm(`Hapus server "${srv.name}"?`)) return;
    const updated = servers.filter(s => s.id !== id);
    saveServers(updated);
    pushLog('info', `Server "${srv.name}" dihapus.`);
    showToast(`Server "${srv.name}" dihapus.`, 'warning');
    renderServerCards();
  }

  /* Edit server modal */
  const editOverlay  = document.getElementById('editServerOverlay');
  const editForm     = document.getElementById('editServerForm');
  const editClose    = document.getElementById('editServerClose');
  const btnCancelEd  = document.getElementById('btnCancelEdit');

  function openEditServerModal(id) {
    const servers = getServers();
    const srv = servers.find(s => s.id === id);
    if (!srv) return;
    document.getElementById('editServerId').value = id;
    document.getElementById('efName').value     = srv.name;
    document.getElementById('efDomain').value   = srv.domain;
    document.getElementById('efIP').value        = srv.ip;
    document.getElementById('efType').value      = srv.type;
    document.getElementById('efLocation').value  = srv.location || '';
    document.getElementById('efOS').value        = srv.os || '';
    document.getElementById('efNotes').value     = srv.notes || '';
    editOverlay.classList.add('open');
  }

  function closeEditServer() {
    editOverlay.classList.remove('open');
    editForm.reset();
  }

  editClose.addEventListener('click', closeEditServer);
  btnCancelEd.addEventListener('click', closeEditServer);
  editOverlay.addEventListener('click', e => {
    if (e.target === editOverlay) closeEditServer();
  });

  editForm.addEventListener('submit', e => {
    e.preventDefault();
    const id     = document.getElementById('editServerId').value;
    const name   = document.getElementById('efName').value.trim();
    const domain = document.getElementById('efDomain').value.trim();
    const ip     = document.getElementById('efIP').value.trim();
    const type   = document.getElementById('efType').value;

    let valid = true;
    ['eerrName','eerrDomain','eerrIP','eerrType'].forEach(id => {
      document.getElementById(id).textContent = '';
    });
    if (!name)   { document.getElementById('eerrName').textContent = 'Wajib diisi.'; valid = false; }
    if (!domain) { document.getElementById('eerrDomain').textContent = 'Wajib diisi.'; valid = false; }
    if (!ip)     { document.getElementById('eerrIP').textContent = 'Wajib diisi.'; valid = false; }
    else if (!validateIPv4(ip)) { document.getElementById('eerrIP').textContent = 'Format IP tidak valid.'; valid = false; }
    if (!type)   { document.getElementById('eerrType').textContent = 'Wajib dipilih.'; valid = false; }
    if (!valid) return;

    const servers = getServers();
    const idx = servers.findIndex(s => s.id === id);
    if (idx === -1) return;

    // Duplicate IP check (allow same server)
    if (servers.some((s, i) => s.ip === ip && i !== idx)) {
      document.getElementById('eerrIP').textContent = 'IP sudah digunakan server lain.';
      return;
    }

    servers[idx] = {
      ...servers[idx],
      name, domain, ip, type,
      location: document.getElementById('efLocation').value.trim(),
      os:       document.getElementById('efOS').value.trim(),
      notes:    document.getElementById('efNotes').value.trim(),
    };
    saveServers(servers);
    pushLog('info', `Server "${name}" diperbarui.`);
    showToast(`Server "${name}" berhasil diperbarui.`, 'success');
    closeEditServer();
    renderServerCards();
  });

  renderServerCards();
}

/* ------------------------------------------------------------------ */
/*  Escape helper (plain fn, shared)                                    */
/* ------------------------------------------------------------------ */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));
}

/* ------------------------------------------------------------------ */
/*  Boot                                                                */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  initShared();
  initDashboard();
  initProfile();
});
