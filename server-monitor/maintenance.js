/* ============================================================
   maintenance.js — Maintenance Window & Change Management
   ============================================================ */
'use strict';

const MW_KEY = 'sw_mw';
const MW_CL_KEY = 'sw_mw_cl';

/* ---- Default sample data ---- */
function defaultMWData() {
  const now = Date.now();
  return [
    {
      id: 'mw_001',
      title: 'Upgrade Kernel — Web Server Utama',
      desc: 'Upgrade Linux kernel 5.15 ke 6.1 LTS, restart server diperlukan. Estimasi downtime 15 menit.',
      servers: ['srv_001'],
      start: new Date(now + 1000 * 60 * 60 * 3).toISOString().slice(0, 16),
      end:   new Date(now + 1000 * 60 * 60 * 4).toISOString().slice(0, 16),
      type: 'Upgrade',
      pic: 'Tim Infrastructure',
      risk: 'medium',
      rollback: 'Reboot ke kernel sebelumnya via GRUB menu.',
      status: 'scheduled',
      createdAt: now - 1000 * 60 * 30,
    },
    {
      id: 'mw_002',
      title: 'Migrasi Database ke SSD Array Baru',
      desc: 'Pemindahan volume data PostgreSQL dari HDD RAID-5 ke NVMe SSD. Estimasi downtime 2 jam.',
      servers: ['srv_002'],
      start: new Date(now + 1000 * 60 * 60 * 26).toISOString().slice(0, 16),
      end:   new Date(now + 1000 * 60 * 60 * 28).toISOString().slice(0, 16),
      type: 'Migration',
      pic: 'Budi / Tim DB',
      risk: 'high',
      rollback: 'Restore dari snapshot yang diambil 1 jam sebelum maintenance.',
      status: 'scheduled',
      createdAt: now - 1000 * 60 * 60 * 2,
    },
    {
      id: 'mw_003',
      title: 'Patch Security OpenSSL — Mail Server',
      desc: 'CVE-2024-xxxx patch untuk OpenSSL 3.0.x. Tidak memerlukan restart layanan.',
      servers: ['srv_003'],
      start: new Date(now - 1000 * 60 * 60 * 48).toISOString().slice(0, 16),
      end:   new Date(now - 1000 * 60 * 60 * 47).toISOString().slice(0, 16),
      type: 'Upgrade',
      pic: 'Tim Security',
      risk: 'low',
      rollback: 'Downgrade OpenSSL ke versi sebelumnya dari paket cache.',
      status: 'completed',
      createdAt: now - 1000 * 60 * 60 * 72,
    },
  ];
}

/* ---- Storage helpers ---- */
function getMWList() {
  const d = JSON.parse(localStorage.getItem(MW_KEY) || 'null');
  if (!d) { const def = defaultMWData(); localStorage.setItem(MW_KEY, JSON.stringify(def)); return def; }
  return d;
}
function saveMWList(list) { localStorage.setItem(MW_KEY, JSON.stringify(list)); }
function getMWCL() { return JSON.parse(localStorage.getItem(MW_CL_KEY) || '[]'); }
function saveMWCL(list) { localStorage.setItem(MW_CL_KEY, JSON.stringify(list.slice(0, 100))); }

function pushCL(action, title, detail = '') {
  const cl = getMWCL();
  cl.unshift({ action, title, detail, time: new Date().toLocaleString('id-ID'), ts: Date.now() });
  saveMWCL(cl);
}

/* ---- Helpers ---- */
function _e(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function fmtDT(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function mwStatusOf(mw) {
  if (mw.status === 'completed' || mw.status === 'cancelled') return mw.status;
  const now = Date.now();
  const start = new Date(mw.start).getTime();
  const end   = new Date(mw.end).getTime();
  if (now >= start && now <= end) return 'in-progress';
  return 'scheduled';
}

function statusLabel(s) {
  return { scheduled: 'Scheduled', 'in-progress': 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }[s] || s;
}

/* ---- Render functions ---- */
let _mwFilter = 'all';
let _mwSearch = '';
let _countdownInterval = null;

function renderMWStats() {
  const list = getMWList();
  const now  = Date.now();
  const upcoming = list.filter(m => {
    const st = new Date(m.start).getTime();
    return mwStatusOf(m) === 'scheduled' && st - now <= 7 * 24 * 60 * 60 * 1000;
  });
  document.getElementById('mwTotal').textContent     = list.length;
  document.getElementById('mwUpcoming').textContent  = upcoming.length;
  document.getElementById('mwDone').textContent      = list.filter(m => m.status === 'completed').length;
  document.getElementById('mwCancelled').textContent = list.filter(m => m.status === 'cancelled').length;
}

function renderCountdownBanner() {
  const banner = document.getElementById('mwCountdownBanner');
  if (!banner) return;
  if (_countdownInterval) clearInterval(_countdownInterval);

  const list = getMWList();
  const now  = Date.now();
  const next = list
    .filter(m => mwStatusOf(m) === 'scheduled')
    .sort((a, b) => new Date(a.start) - new Date(b.start))[0];

  if (!next) { banner.style.display = 'none'; return; }

  const startMs = new Date(next.start).getTime();
  if (startMs - now > 24 * 60 * 60 * 1000) { banner.style.display = 'none'; return; }

  banner.style.display = '';
  banner.innerHTML = `
    <div class="mw-countdown-banner">
      <span class="mw-countdown-icon">⚙</span>
      <span class="mw-countdown-text"><strong>${_e(next.title)}</strong> dimulai dalam</span>
      <span class="mw-countdown-timer" id="cdTimer">—</span>
    </div>`;

  const tick = () => {
    const diff = new Date(next.start).getTime() - Date.now();
    if (diff <= 0) { clearInterval(_countdownInterval); banner.style.display = 'none'; return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById('cdTimer');
    if (el) el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  tick();
  _countdownInterval = setInterval(tick, 1000);
}

function renderMWTable() {
  const tbody  = document.getElementById('mwTbody');
  const emptyEl = document.getElementById('mwEmpty');
  let list = getMWList();

  if (_mwSearch) {
    const q = _mwSearch.toLowerCase();
    list = list.filter(m => m.title.toLowerCase().includes(q) || m.pic?.toLowerCase().includes(q));
  }
  if (_mwFilter !== 'all') {
    list = list.filter(m => mwStatusOf(m) === _mwFilter);
  }
  list = list.sort((a, b) => new Date(a.start) - new Date(b.start));

  if (!list.length) {
    tbody.innerHTML = '';
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  tbody.innerHTML = list.map((mw, i) => {
    const st     = mwStatusOf(mw);
    const srvAll = getServers();
    const srvNames = (mw.servers || []).map(id => {
      const s = srvAll.find(x => x.id === id);
      return s ? `<span class="type-badge">${_e(s.name)}</span>` : '';
    }).join(' ');
    return `<tr>
      <td class="td-num">${i + 1}</td>
      <td>
        <div class="cell-name">
          <span class="srv-name">${_e(mw.title)}</span>
          <span class="srv-os">${_e(mw.desc?.slice(0, 60) || '')}${mw.desc?.length > 60 ? '…' : ''}</span>
        </div>
      </td>
      <td style="max-width:180px;">${srvNames || '<span style="color:var(--text-dim)">—</span>'}</td>
      <td style="font-size:.8rem;white-space:nowrap;">${fmtDT(mw.start)}</td>
      <td style="font-size:.8rem;white-space:nowrap;">${fmtDT(mw.end)}</td>
      <td><span class="mw-type-badge">${_e(mw.type)}</span></td>
      <td style="font-size:.8rem;color:var(--text-muted);">${_e(mw.pic || '—')}</td>
      <td>
        <span class="mw-status-badge ${st}">${statusLabel(st)}</span>
        &nbsp;<span class="mw-risk-badge ${mw.risk}">${mw.risk}</span>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" data-mwdetail="${mw.id}" title="Detail">⊙</button>
          <button class="btn-icon" data-mwedit="${mw.id}" title="Edit">✎</button>
          ${st !== 'completed' && st !== 'cancelled' ? `<button class="btn-icon" data-mwdone="${mw.id}" title="Tandai Selesai" style="color:var(--green)">✔</button>` : ''}
          ${st !== 'cancelled' && st !== 'completed' ? `<button class="btn-icon" data-mwcancel="${mw.id}" title="Batalkan" style="color:var(--yellow)">⊗</button>` : ''}
          <button class="btn-icon btn-delete" data-mwdel="${mw.id}" title="Hapus">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderTimeline() {
  const el = document.getElementById('mwTimeline');
  const cl = getMWCL();
  if (!cl.length) { el.innerHTML = '<div class="log-empty">Belum ada perubahan tercatat.</div>'; return; }
  el.innerHTML = cl.map(e => `
    <div class="mw-tl-item">
      <div class="mw-tl-dot-col">
        <div class="mw-tl-dot ${e.action}"></div>
        <div class="mw-tl-line"></div>
      </div>
      <div class="mw-tl-content">
        <div class="mw-tl-title">${_e(e.title)}</div>
        <div class="mw-tl-meta">${_e(e.detail)} · ${e.time}</div>
      </div>
    </div>
  `).join('');
}

function fullRender() {
  renderMWStats();
  renderCountdownBanner();
  renderMWTable();
  renderTimeline();
}

/* ---- Modal ---- */
function openMWModal(id = null) {
  const title = document.getElementById('mwModalTitle');
  title.textContent = id ? 'Edit Maintenance Window' : 'Jadwalkan Maintenance Window';
  document.getElementById('mwEditId').value = id || '';

  // Build server checkboxes
  const container = document.getElementById('mwServerCheckboxes');
  const servers   = getServers();
  const mw        = id ? getMWList().find(m => m.id === id) : null;
  container.innerHTML = servers.length
    ? servers.map(s => `
        <label class="mw-checkbox-item">
          <input type="checkbox" value="${s.id}" ${mw?.servers?.includes(s.id) ? 'checked' : ''} />
          <span>${_e(s.name)} <span style="color:var(--text-dim);font-size:.72rem;">(${_e(s.ip)})</span></span>
        </label>`).join('')
    : '<span style="color:var(--text-dim);font-size:.82rem;">Tidak ada server terdaftar.</span>';

  if (mw) {
    document.getElementById('mwTitle').value    = mw.title;
    document.getElementById('mwDesc').value     = mw.desc || '';
    document.getElementById('mwStart').value    = mw.start;
    document.getElementById('mwEnd').value      = mw.end;
    document.getElementById('mwType').value     = mw.type;
    document.getElementById('mwPIC').value      = mw.pic || '';
    document.getElementById('mwRisk').value     = mw.risk;
    document.getElementById('mwRollback').value = mw.rollback || '';
  } else {
    document.getElementById('mwForm').reset();
    // Default start = now + 1h, end = now + 2h
    const base = new Date(Date.now() + 3600000);
    document.getElementById('mwStart').value = base.toISOString().slice(0, 16);
    document.getElementById('mwEnd').value   = new Date(base.getTime() + 3600000).toISOString().slice(0, 16);
  }
  document.getElementById('mwModalOverlay').classList.add('open');
}

function closeMWModal() {
  document.getElementById('mwModalOverlay').classList.remove('open');
}

function openMWDetail(id) {
  const list = getMWList();
  const mw   = list.find(m => m.id === id);
  if (!mw) return;
  const servers = getServers();
  const st      = mwStatusOf(mw);
  const srvTags = (mw.servers || []).map(sid => {
    const s = servers.find(x => x.id === sid);
    return s ? `<span class="type-badge">${_e(s.name)}</span>` : '';
  }).join(' ') || '—';

  document.getElementById('mwDetailTitle').textContent = mw.title;
  document.getElementById('mwDetailBody').innerHTML = `
    <table class="detail-table">
      <tr><th>Status</th><td><span class="mw-status-badge ${st}">${statusLabel(st)}</span> <span class="mw-risk-badge ${mw.risk}">${mw.risk}</span></td></tr>
      <tr><th>Tipe</th><td><span class="mw-type-badge">${_e(mw.type)}</span></td></tr>
      <tr><th>Server Terdampak</th><td><div class="mw-detail-servers">${srvTags}</div></td></tr>
      <tr><th>Mulai</th><td>${fmtDT(mw.start)}</td></tr>
      <tr><th>Selesai</th><td>${fmtDT(mw.end)}</td></tr>
      <tr><th>PIC</th><td>${_e(mw.pic || '—')}</td></tr>
      <tr><th>Deskripsi</th><td style="white-space:pre-wrap;">${_e(mw.desc || '—')}</td></tr>
      <tr><th>Rollback Plan</th><td style="white-space:pre-wrap;color:var(--yellow);">${_e(mw.rollback || 'Tidak ada')}</td></tr>
    </table>
  `;
  document.getElementById('mwDetailOverlay').classList.add('open');
}

/* ---- iCal Export ---- */
function exportICal() {
  const list = getMWList();
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ServerWatch//IT Ops//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  ];
  list.forEach(mw => {
    const dtStart = new Date(mw.start).toISOString().replace(/[-:]/g,'').replace('.000','');
    const dtEnd   = new Date(mw.end).toISOString().replace(/[-:]/g,'').replace('.000','');
    lines.push('BEGIN:VEVENT',
      `UID:${mw.id}@serverwatch`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${mw.title.replace(/,/g,'\\,')}`,
      `DESCRIPTION:Type: ${mw.type} | PIC: ${mw.pic || '—'} | Risk: ${mw.risk}`,
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'maintenance-windows.ics'; a.click();
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('File iCal diekspor.', 'success');
}

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('mwTbody')) return;

  fullRender();

  // Filter buttons
  document.querySelectorAll('[data-mwfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mwfilter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _mwFilter = btn.dataset.mwfilter;
      renderMWTable();
    });
  });

  // Search
  document.getElementById('mwSearch').addEventListener('input', e => {
    _mwSearch = e.target.value.trim();
    renderMWTable();
  });

  // New button
  document.getElementById('btnNewMW').addEventListener('click', () => openMWModal());
  document.getElementById('mwModalClose').addEventListener('click', closeMWModal);
  document.getElementById('mwFormCancel').addEventListener('click', closeMWModal);
  document.getElementById('mwModalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('mwModalOverlay')) closeMWModal();
  });

  // Detail close
  document.getElementById('mwDetailClose').addEventListener('click', () => {
    document.getElementById('mwDetailOverlay').classList.remove('open');
  });
  document.getElementById('mwDetailOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('mwDetailOverlay'))
      document.getElementById('mwDetailOverlay').classList.remove('open');
  });

  // Export iCal
  document.getElementById('btnExportCal').addEventListener('click', e => { e.preventDefault(); exportICal(); });

  // Clear change log
  document.getElementById('btnClearCL').addEventListener('click', () => {
    localStorage.removeItem(MW_CL_KEY);
    renderTimeline();
  });

  // Form submit
  document.getElementById('mwForm').addEventListener('submit', e => {
    e.preventDefault();
    const id      = document.getElementById('mwEditId').value;
    const title   = document.getElementById('mwTitle').value.trim();
    const desc    = document.getElementById('mwDesc').value.trim();
    const start   = document.getElementById('mwStart').value;
    const end     = document.getElementById('mwEnd').value;
    const type    = document.getElementById('mwType').value;
    const pic     = document.getElementById('mwPIC').value.trim();
    const risk    = document.getElementById('mwRisk').value;
    const rollback = document.getElementById('mwRollback').value.trim();
    const servers = [...document.querySelectorAll('#mwServerCheckboxes input:checked')].map(cb => cb.value);

    // Clear errors
    document.getElementById('mwErrTitle').textContent = '';
    document.getElementById('mwErrServers').textContent = '';
    document.getElementById('mwErrStart').textContent = '';
    document.getElementById('mwErrEnd').textContent = '';

    let valid = true;
    if (!title)   { document.getElementById('mwErrTitle').textContent = 'Judul wajib diisi.'; valid = false; }
    if (!servers.length) { document.getElementById('mwErrServers').textContent = 'Pilih minimal satu server.'; valid = false; }
    if (!start)   { document.getElementById('mwErrStart').textContent = 'Waktu mulai wajib diisi.'; valid = false; }
    if (!end)     { document.getElementById('mwErrEnd').textContent = 'Waktu selesai wajib diisi.'; valid = false; }
    else if (end <= start) { document.getElementById('mwErrEnd').textContent = 'Waktu selesai harus setelah waktu mulai.'; valid = false; }
    if (!valid) return;

    const list = getMWList();
    if (id) {
      const idx = list.findIndex(m => m.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], title, desc, servers, start, end, type, pic, risk, rollback };
        pushCL('scheduled', `Edit: ${title}`, `Oleh IT Ops`);
      }
    } else {
      const newMW = { id: 'mw_' + Date.now(), title, desc, servers, start, end, type, pic, risk, rollback, status: 'scheduled', createdAt: Date.now() };
      list.push(newMW);
      pushCL('scheduled', `Jadwal baru: ${title}`, `Mulai ${fmtDT(start)}`);
    }
    saveMWList(list);
    fullRender();
    closeMWModal();
    if (typeof showToast === 'function') showToast(id ? 'Maintenance window diperbarui.' : 'Maintenance window dijadwalkan.', 'success');
  });

  // Table action delegation
  document.getElementById('mwTbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-mwdetail],[data-mwedit],[data-mwdone],[data-mwcancel],[data-mwdel]');
    if (!btn) return;
    const list = getMWList();

    if (btn.dataset.mwdetail) { openMWDetail(btn.dataset.mwdetail); return; }

    if (btn.dataset.mwedit) { openMWModal(btn.dataset.mwedit); return; }

    if (btn.dataset.mwdone) {
      const idx = list.findIndex(m => m.id === btn.dataset.mwdone);
      if (idx >= 0) {
        list[idx].status = 'completed';
        pushCL('completed', `Selesai: ${list[idx].title}`, fmtDT(new Date().toISOString()));
        saveMWList(list);
        fullRender();
        if (typeof showToast === 'function') showToast('Maintenance ditandai selesai.', 'success');
      }
      return;
    }

    if (btn.dataset.mwcancel) {
      if (!confirm('Batalkan maintenance window ini?')) return;
      const idx = list.findIndex(m => m.id === btn.dataset.mwcancel);
      if (idx >= 0) {
        list[idx].status = 'cancelled';
        pushCL('cancelled', `Dibatalkan: ${list[idx].title}`, '');
        saveMWList(list);
        fullRender();
        if (typeof showToast === 'function') showToast('Maintenance dibatalkan.', 'warning');
      }
      return;
    }

    if (btn.dataset.mwdel) {
      const mw = list.find(m => m.id === btn.dataset.mwdel);
      if (!mw || !confirm(`Hapus "${mw.title}"?`)) return;
      const updated = list.filter(m => m.id !== btn.dataset.mwdel);
      saveMWList(updated);
      fullRender();
      if (typeof showToast === 'function') showToast('Maintenance window dihapus.', 'warning');
    }
  });
});
