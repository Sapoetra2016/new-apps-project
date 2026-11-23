/* ============================================================
   nettools.js — Network Tools (Ping, Traceroute, Port Scan,
                 DNS Lookup, SSL Check, WHOIS, Bandwidth Calc)
   All tools run full client-side simulations (no backend needed)
   ============================================================ */
'use strict';

const NT_HISTORY_KEY = 'sw_nt_history';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function _e(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function ntNow() {
  return new Date().toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function pushNTHistory(tool, target, summary) {
  const list = JSON.parse(localStorage.getItem(NT_HISTORY_KEY) || '[]');
  list.unshift({ tool, target, summary, time: ntNow(), ts: Date.now() });
  localStorage.setItem(NT_HISTORY_KEY, JSON.stringify(list.slice(0, 80)));
}

function renderNTHistory() {
  const logEl = document.getElementById('ntHistoryLog');
  if (!logEl) return;
  const list = JSON.parse(localStorage.getItem(NT_HISTORY_KEY) || '[]');
  if (!list.length) { logEl.innerHTML = '<div class="log-empty">Belum ada riwayat penggunaan.</div>'; return; }
  logEl.innerHTML = list.slice(0, 40).map(e => `
    <div class="log-entry">
      <span class="log-time">${e.time}</span>
      <span class="log-dot info"></span>
      <span class="log-msg"><strong>[${_e(e.tool)}]</strong> ${_e(e.target)} — ${_e(e.summary)}</span>
    </div>`).join('');
}

function showRunning(el) {
  el.innerHTML = `<div class="nt-running"><div class="nt-spinner"></div>Sedang menjalankan simulasi…</div>`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---- Deterministic pseudo-random based on string seed ---- */
function seededRand(str, offset = 0) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  h = Math.abs(h + offset * 7919);
  return (h % 1000) / 1000; // 0–0.999
}

function pingMs(host, seq) {
  const base  = 5 + seededRand(host) * 120;
  const jitter = (seededRand(host, seq) - 0.5) * 30;
  const ms    = Math.round(base + jitter);
  if (seededRand(host, seq + 100) < 0.05) return -1; // 5% timeout
  if (seededRand(host, seq + 200) < 0.07) return ms * 4; // 7% spike
  return Math.max(1, ms);
}

function pingClass(ms) {
  if (ms < 0)   return 'bad';
  if (ms < 100) return 'good';
  if (ms < 300) return 'medium';
  return 'bad';
}

function ipFromHost(host) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  // Fake resolution
  const oct = [
    Math.floor(seededRand(host, 1) * 223) + 1,
    Math.floor(seededRand(host, 2) * 254) + 1,
    Math.floor(seededRand(host, 3) * 254),
    Math.floor(seededRand(host, 4) * 254) + 1,
  ];
  return oct.join('.');
}

/* ================================================================== */
/*  1. PING                                                             */
/* ================================================================== */
async function runPing(targets, count, resultEl) {
  showRunning(resultEl);
  await delay(400 + Math.random() * 400);

  const rows = targets.map(host => {
    const pings = Array.from({ length: count }, (_, i) => pingMs(host, i));
    const valid = pings.filter(p => p > 0);
    const loss  = Math.round((pings.filter(p => p < 0).length / count) * 100);
    const avg   = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : -1;
    const min   = valid.length ? Math.min(...valid) : -1;
    const max   = valid.length ? Math.max(...valid) : -1;
    const jitter = valid.length > 1 ? Math.round(Math.sqrt(valid.reduce((s, v) => s + (v - avg) ** 2, 0) / valid.length)) : 0;
    const status = avg < 0 ? 'offline' : avg < 100 ? 'online' : 'warning';
    const sparkBars = pings.map(p => {
      const h = p < 0 ? 20 : Math.max(3, Math.min(20, Math.round((p / (max || 1)) * 20)));
      return `<div class="nt-ping-spark-bar ${pingClass(p)}" style="height:${h}px"></div>`;
    }).join('');
    return `<tr>
      <td>${_e(host)}</td>
      <td style="font-family:monospace;font-size:.78rem;">${_e(ipFromHost(host))}</td>
      <td><span class="status-badge ${status}"><span class="pulse"></span>${status === 'online' ? 'Reachable' : status === 'offline' ? 'Unreachable' : 'High Latency'}</span></td>
      <td class="ping-val ${pingClass(avg)}">${avg > 0 ? avg + ' ms' : '—'}</td>
      <td style="color:var(--text-muted);font-size:.78rem;">${min > 0 ? min : '—'} / ${avg > 0 ? avg : '—'} / ${max > 0 ? max : '—'} ms</td>
      <td style="color:var(--text-muted);font-size:.78rem;">${jitter} ms</td>
      <td style="color:${loss > 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">${loss}%</td>
      <td><div class="nt-ping-sparkline">${sparkBars}</div></td>
    </tr>`;
  });

  resultEl.innerHTML = `
    <div class="table-wrap" style="margin-top:0;">
      <table class="nt-ping-table">
        <thead><tr>
          <th>Host</th><th>IP</th><th>Status</th>
          <th>Avg Latency</th><th>Min/Avg/Max</th><th>Jitter</th><th>Packet Loss</th><th>Sparkline (${count}x)</th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <div style="font-size:.73rem;color:var(--text-dim);padding:.4rem .2rem;">
      Simulasi ping — ${count} paket per host · ${ntNow()}
    </div>`;

  pushNTHistory('Ping', targets.join(', '), `${targets.length} host, avg loss ${Math.round(targets.reduce((a, h) => {
    const pings = Array.from({length:count},(_,i) => pingMs(h,i));
    return a + pings.filter(p=>p<0).length / count * 100;
  }, 0) / targets.length)}%`);
  renderNTHistory();
}

/* ================================================================== */
/*  2. TRACEROUTE                                                       */
/* ================================================================== */
async function runTraceroute(target, maxHop, resultEl) {
  showRunning(resultEl);
  await delay(600 + Math.random() * 600);

  const hops = [];
  const baseLatency = 5 + seededRand(target) * 20;
  for (let i = 1; i <= maxHop; i++) {
    const rnd = seededRand(target, i);
    // 10% timeout hops
    if (rnd < 0.08 && i > 1 && i < maxHop - 1) {
      hops.push({ hop: i, ip: '*', host: '*', ms1: -1, ms2: -1, ms3: -1 });
      continue;
    }
    const ms1  = Math.round(baseLatency * i * (1 + seededRand(target, i * 10) * 0.4));
    const ms2  = Math.round(ms1 * (1 + seededRand(target, i * 11) * 0.1));
    const ms3  = Math.round(ms1 * (1 + seededRand(target, i * 12) * 0.1));
    const ipArr = [
      Math.floor(seededRand(target, i + 1) * 200) + 10,
      Math.floor(seededRand(target, i + 2) * 254),
      Math.floor(seededRand(target, i + 3) * 254),
      Math.floor(seededRand(target, i + 4) * 254) + 1,
    ];
    const hopIP = i === maxHop ? ipFromHost(target) : ipArr.join('.');
    const hostName = i === maxHop ? target : (seededRand(target, i + 50) < 0.4 ? `router-${i}.isp.net` : '');
    hops.push({ hop: i, ip: hopIP, host: hostName, ms1, ms2, ms3 });
    if (i === maxHop) break;
  }

  const maxMs = Math.max(...hops.flatMap(h => [h.ms1, h.ms2, h.ms3]).filter(v => v > 0), 1);

  const rows = hops.map(h => {
    const ms = h.ms1 > 0 ? h.ms1 : -1;
    const cls = ms < 0 ? 'timeout' : ms < 100 ? 'good' : ms < 300 ? 'medium' : 'bad';
    const msText = ms < 0 ? '* * *' : `${h.ms1}ms / ${h.ms2}ms / ${h.ms3}ms`;
    const barW   = ms < 0 ? 0 : Math.round((ms / maxMs) * 100);
    const barColor = ms < 100 ? 'var(--green)' : ms < 300 ? 'var(--yellow)' : 'var(--red)';
    return `<div class="nt-trace-row">
      <span class="nt-trace-hop">${h.hop}</span>
      <span class="nt-trace-ip">${_e(h.ip)}</span>
      <span style="font-size:.72rem;color:var(--text-dim);">${_e(h.host || '')}</span>
      <span class="nt-trace-ms ${cls}">${msText}</span>
      <div class="nt-trace-bar-wrap"><div class="nt-trace-bar" style="width:${barW}%;background:${barColor}"></div></div>
    </div>`;
  });

  resultEl.innerHTML = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
      <div style="padding:.6rem 1rem;background:var(--bg3);border-bottom:1px solid var(--border);display:grid;grid-template-columns:36px 160px 100px 100px 1fr;gap:.5rem;font-size:.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;">
        <span>HOP</span><span>IP</span><span>Hostname</span><span>RTT (3 probe)</span><span>Latency Bar</span>
      </div>
      <div style="padding:.4rem;">${rows.join('')}</div>
    </div>
    <div style="font-size:.73rem;color:var(--text-dim);padding:.4rem .2rem;">
      Traceroute ke ${_e(target)} — ${hops.length} hops · ${ntNow()}
    </div>`;

  pushNTHistory('Traceroute', target, `${hops.length} hops, final RTT: ${hops[hops.length-1]?.ms1 || '?'}ms`);
  renderNTHistory();
}

/* ================================================================== */
/*  3. PORT SCANNER                                                     */
/* ================================================================== */
const PORT_SERVICES = {
  22:'SSH', 23:'Telnet', 25:'SMTP', 53:'DNS', 80:'HTTP', 110:'POP3',
  123:'NTP', 143:'IMAP', 161:'SNMP', 162:'SNMP Trap', 443:'HTTPS',
  465:'SMTPS', 587:'SMTP/TLS', 993:'IMAPS', 995:'POP3S',
  1433:'MSSQL', 3306:'MySQL', 3389:'RDP', 5432:'PostgreSQL',
  5900:'VNC', 6379:'Redis', 8080:'HTTP-Alt', 8443:'HTTPS-Alt', 27017:'MongoDB',
};

const PORT_PRESETS = {
  web:      [80, 443, 8080, 8443],
  database: [3306, 5432, 1433, 6379, 27017],
  mail:     [25, 465, 587, 110, 143, 993, 995],
  remote:   [22, 23, 3389, 5900],
  dns:      [53, 123, 161, 162],
};

async function runPortScan(host, ports, resultEl) {
  showRunning(resultEl);
  await delay(500 + Math.random() * 800);

  const results = ports.map(port => {
    const r     = seededRand(host, port);
    const rPort = seededRand(host + String(port), port + 1);
    // Well-known ports are more likely open
    const wellKnownOpen = [22,80,443,3306,5432].includes(port);
    const isOpen     = wellKnownOpen ? r < 0.75 : r < 0.35;
    const isFiltered = !isOpen && rPort < 0.3;
    const status = isOpen ? 'open' : isFiltered ? 'filtered' : 'closed';
    const ms     = isOpen ? Math.round(5 + seededRand(host, port + 999) * 60) : null;
    return { port, status, service: PORT_SERVICES[port] || 'unknown', ms };
  });

  const open     = results.filter(r => r.status === 'open').length;
  const filtered = results.filter(r => r.status === 'filtered').length;
  const closed   = results.filter(r => r.status === 'closed').length;

  resultEl.innerHTML = `
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem;">
      <div style="font-size:.82rem;color:var(--text-muted);">
        Host: <strong style="color:var(--text)">${_e(host)}</strong> (${_e(ipFromHost(host))})
      </div>
      <div style="font-size:.82rem;">
        <span style="color:var(--green);font-weight:600;">${open} Open</span> ·
        <span style="color:var(--yellow);">${filtered} Filtered</span> ·
        <span style="color:var(--text-dim);">${closed} Closed</span>
      </div>
    </div>
    <div class="nt-port-grid">
      ${results.map(r => `
        <div class="nt-port-item ${r.status}">
          <span class="nt-port-num">${r.port}</span>
          <span class="nt-port-svc">${_e(r.service)}</span>
          <span class="nt-port-status ${r.status}">${r.status}${r.ms !== null ? ` · ${r.ms}ms` : ''}</span>
        </div>`).join('')}
    </div>
    <div style="font-size:.73rem;color:var(--text-dim);padding:.4rem .2rem;margin-top:.5rem;">
      Scan ${ports.length} port pada ${_e(host)} · ${ntNow()}
    </div>`;

  pushNTHistory('Port Scan', host, `${open} open, ${filtered} filtered, ${closed} closed`);
  renderNTHistory();
}

/* ================================================================== */
/*  4. DNS LOOKUP                                                       */
/* ================================================================== */
function fakeDNS(domain, type, dnsServer) {
  const ip = ipFromHost(domain);
  const seed = seededRand(domain);

  const records = {
    A:    [{ val: ip, ttl: 300 }],
    AAAA: seed > 0.5 ? [{ val: `2001:db8:${Math.floor(seed*9999)}::1`, ttl: 300 }] : [],
    MX:   [
      { val: `mail1.${domain} (priority 10)`, ttl: 3600 },
      { val: `mail2.${domain} (priority 20)`, ttl: 3600 },
    ],
    NS: [
      { val: `ns1.${domain}`, ttl: 86400 },
      { val: `ns2.${domain}`, ttl: 86400 },
    ],
    TXT: [
      { val: `"v=spf1 ip4:${ip} ~all"`, ttl: 3600 },
      { val: `"google-site-verification=abc123def456"`, ttl: 3600 },
    ],
    CNAME: seed > 0.6 ? [{ val: `www.${domain}`, ttl: 300 }] : [],
    PTR:  [{ val: `${domain}`, ttl: 3600 }],
    SOA:  [{ val: `ns1.${domain} hostmaster.${domain} 2024112101 3600 900 604800 300`, ttl: 86400 }],
  };

  if (type === 'ALL') return Object.entries(records).flatMap(([t, recs]) => recs.map(r => ({ type: t, ...r })));
  return (records[type] || []).map(r => ({ type, ...r }));
}

async function runDNS(domain, type, dnsServer, resultEl) {
  showRunning(resultEl);
  await delay(300 + Math.random() * 400);

  const records = fakeDNS(domain, type, dnsServer);
  const resolveMs = Math.round(10 + seededRand(domain) * 50);

  if (!records.length) {
    resultEl.innerHTML = `<div class="nt-result-empty">Tidak ada record ${_e(type)} ditemukan untuk <strong>${_e(domain)}</strong>.</div>`;
    return;
  }

  resultEl.innerHTML = `
    <div style="font-size:.78rem;color:var(--text-dim);margin-bottom:.5rem;">
      Server: <strong>${_e(dnsServer)}</strong> · Resolved in ${resolveMs}ms · ${ntNow()}
    </div>
    <div style="display:flex;flex-direction:column;gap:.35rem;">
      ${records.map(r => `
        <div class="nt-dns-record">
          <span class="nt-dns-type">${_e(r.type)}</span>
          <span class="nt-dns-val">${_e(r.val)}</span>
          <span class="nt-dns-ttl">TTL: ${r.ttl}s</span>
        </div>`).join('')}
    </div>`;

  pushNTHistory('DNS Lookup', `${domain} [${type}]`, `${records.length} record(s) · server ${dnsServer}`);
  renderNTHistory();
}

/* ================================================================== */
/*  5. SSL/TLS CHECK                                                    */
/* ================================================================== */
async function runSSL(domains, resultEl) {
  showRunning(resultEl);
  await delay(400 + Math.random() * 600);

  const cards = domains.map(domain => {
    const seed = seededRand(domain);
    // 85% valid, 10% expiring, 5% expired/invalid
    const expireDays = seed < 0.05 ? Math.round(seed * 100) - 50
                     : seed < 0.15 ? Math.round(5 + seed * 200)
                     : Math.round(30 + seed * 300);
    const expireDate = new Date(Date.now() + expireDays * 86400000);
    const isValid   = expireDays > 0;
    const isExpiring = isValid && expireDays < 30;
    const statusClass = !isValid ? 'nt-ssl-invalid' : isExpiring ? 'nt-ssl-expiring' : 'nt-ssl-valid';
    const statusText  = !isValid ? '✕ Expired / Invalid' : isExpiring ? `⚠ Expires in ${expireDays} days` : `✔ Valid (${expireDays} days left)`;
    const ciphers = ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256', 'ECDHE-RSA-AES256-GCM-SHA384'];
    const cipher = ciphers[Math.floor(seed * ciphers.length)];
    const issuer = seed < 0.5 ? 'Let\'s Encrypt Authority X3' : seed < 0.75 ? 'DigiCert SHA2 Secure Server CA' : 'GlobalSign RSA OV SSL CA 2018';
    const tls    = seed > 0.6 ? 'TLS 1.3' : 'TLS 1.2';

    return `<div class="nt-ssl-card">
      <div class="nt-ssl-header">
        <span class="nt-ssl-domain">${_e(domain)}</span>
        <span class="${statusClass}">${statusText}</span>
      </div>
      <div class="nt-ssl-body">
        <div class="nt-ssl-field"><span class="nt-ssl-label">Issuer</span><span class="nt-ssl-value">${_e(issuer)}</span></div>
        <div class="nt-ssl-field"><span class="nt-ssl-label">Expires</span><span class="nt-ssl-value">${expireDate.toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})}</span></div>
        <div class="nt-ssl-field"><span class="nt-ssl-label">Protocol</span><span class="nt-ssl-value">${tls}</span></div>
        <div class="nt-ssl-field"><span class="nt-ssl-label">Cipher Suite</span><span class="nt-ssl-value" style="font-size:.72rem;">${_e(cipher)}</span></div>
        <div class="nt-ssl-field"><span class="nt-ssl-label">SANs</span><span class="nt-ssl-value">${_e(domain)}, www.${_e(domain)}</span></div>
        <div class="nt-ssl-field"><span class="nt-ssl-label">HSTS</span><span class="nt-ssl-value" style="color:${seed>0.4?'var(--green)':'var(--yellow)'};">${seed > 0.4 ? '✔ Enabled' : '✕ Not set'}</span></div>
      </div>
    </div>`;
  });

  resultEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:.6rem;">${cards.join('')}</div>
    <div style="font-size:.73rem;color:var(--text-dim);padding:.4rem .2rem;">${domains.length} domain dicek · ${ntNow()}</div>`;

  const expiring = domains.filter(d => { const s=seededRand(d); return s>=0.05 && s<0.15; }).length;
  const expired  = domains.filter(d => seededRand(d) < 0.05).length;
  pushNTHistory('SSL Check', domains.join(', '), `${domains.length} domain · ${expiring} expiring · ${expired} expired`);
  renderNTHistory();
}

/* ================================================================== */
/*  6. WHOIS                                                            */
/* ================================================================== */
async function runWhois(domain, resultEl) {
  showRunning(resultEl);
  await delay(400 + Math.random() * 500);

  const seed    = seededRand(domain);
  const regDate = new Date(Date.now() - (1 + Math.floor(seed * 10)) * 365 * 86400000);
  const expDate = new Date(regDate.getTime() + (1 + Math.floor(seededRand(domain, 1) * 5)) * 365 * 86400000);
  const daysLeft= Math.round((expDate - Date.now()) / 86400000);
  const registrars = ['GoDaddy LLC', 'Namecheap Inc.', 'Cloudflare Inc.', 'PT. Web Media Technology Indonesia', 'PT. Niagahoster'];
  const registrar   = registrars[Math.floor(seed * registrars.length)];
  const statuses   = ['clientTransferProhibited', 'clientUpdateProhibited'];

  const fmtDate = d => d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });

  resultEl.innerHTML = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1rem 1.25rem;">
      <table class="detail-table">
        <tr><th>Domain</th><td style="font-weight:700;color:var(--accent);">${_e(domain.toUpperCase())}</td></tr>
        <tr><th>Registrar</th><td>${_e(registrar)}</td></tr>
        <tr><th>Registered</th><td>${fmtDate(regDate)}</td></tr>
        <tr><th>Expires</th><td style="color:${daysLeft < 30 ? 'var(--red)' : daysLeft < 90 ? 'var(--yellow)' : 'var(--green)'};">
          ${fmtDate(expDate)} <span style="font-size:.8rem;">(${daysLeft > 0 ? daysLeft + ' hari lagi' : 'EXPIRED'})</span>
        </td></tr>
        <tr><th>Name Servers</th><td>ns1.${_e(domain)}<br>ns2.${_e(domain)}</td></tr>
        <tr><th>Status</th><td>${statuses.map(s => `<span class="type-badge" style="margin:1px">${_e(s)}</span>`).join(' ')}</td></tr>
        <tr><th>DNSSEC</th><td style="color:${seed>0.5?'var(--green)':'var(--text-dim)'};">${seed > 0.5 ? 'Signed' : 'Unsigned'}</td></tr>
      </table>
    </div>
    <div style="font-size:.73rem;color:var(--text-dim);padding:.4rem .2rem;">${ntNow()}</div>`;

  pushNTHistory('WHOIS', domain, `Expires: ${fmtDate(expDate)} (${daysLeft}d left)`);
  renderNTHistory();
}

/* ================================================================== */
/*  7. BANDWIDTH ESTIMATOR                                              */
/* ================================================================== */
const BW_BASE = {
  web:       { mbps: 2,   desc: 'Web Browsing (average 2 Mbps/user)' },
  video:     { mbps: 8,   desc: 'Video Streaming HD (8 Mbps/user)' },
  voip:      { mbps: 0.1, desc: 'VoIP/Video Call (100 Kbps/user)' },
  fileshare: { mbps: 50,  desc: 'File Transfer/Backup (50 Mbps peak)' },
  erp:       { mbps: 1.5, desc: 'ERP/Database App (1.5 Mbps/user)' },
  mixed:     { mbps: 5,   desc: 'Mixed Usage (avg 5 Mbps/user)' },
};
const BW_QUALITY = { basic: 0.7, standard: 1.0, premium: 1.4 };

function calcBandwidth(users, service, quality, redundancy) {
  const base   = BW_BASE[service];
  const raw    = base.mbps * users;
  const withQ  = raw * BW_QUALITY[quality];
  const total  = withQ * parseFloat(redundancy);
  const gbps   = total >= 1000 ? (total / 1000).toFixed(2) + ' Gbps' : total.toFixed(0) + ' Mbps';
  const recommended = Math.ceil(total / 100) * 100;
  return { raw, withQ, total, gbps, recommended, base };
}

function runBandwidth(users, service, quality, redundancy, resultEl) {
  const result = calcBandwidth(users, service, quality, redundancy);
  resultEl.innerHTML = `
    <div class="bw-result-grid" style="margin-top:.75rem;">
      <div class="bw-result-card">
        <span class="bw-label">Raw Requirement</span>
        <span class="bw-value">${result.raw >= 1000 ? (result.raw/1000).toFixed(1) : result.raw.toFixed(0)}</span>
        <span class="bw-unit">${result.raw >= 1000 ? 'Gbps' : 'Mbps'}</span>
        <div class="bw-breakdown">${users} user × ${result.base.mbps} Mbps</div>
      </div>
      <div class="bw-result-card">
        <span class="bw-label">Dengan Quality Factor</span>
        <span class="bw-value">${result.withQ >= 1000 ? (result.withQ/1000).toFixed(1) : result.withQ.toFixed(0)}</span>
        <span class="bw-unit">${result.withQ >= 1000 ? 'Gbps' : 'Mbps'}</span>
        <div class="bw-breakdown">Quality: ${quality} (×${BW_QUALITY[quality]})</div>
      </div>
      <div class="bw-result-card" style="border-color:var(--accent);">
        <span class="bw-label">Total + Redundansi</span>
        <span class="bw-value">${result.total >= 1000 ? (result.total/1000).toFixed(1) : result.total.toFixed(0)}</span>
        <span class="bw-unit">${result.total >= 1000 ? 'Gbps' : 'Mbps'}</span>
        <div class="bw-breakdown">Overhead ×${redundancy}</div>
      </div>
      <div class="bw-result-card" style="border-color:var(--green);">
        <span class="bw-label">Rekomendasi Pembelian</span>
        <span class="bw-value" style="color:var(--green);">${result.recommended >= 1000 ? (result.recommended/1000).toFixed(0) : result.recommended}</span>
        <span class="bw-unit">${result.recommended >= 1000 ? 'Gbps' : 'Mbps'}</span>
        <div class="bw-breakdown">Dibulatkan ke angka komersial</div>
      </div>
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:.75rem 1rem;margin-top:.75rem;font-size:.8rem;color:var(--text-muted);line-height:1.7;">
      <strong style="color:var(--text);">Rincian Kalkulasi</strong><br>
      Layanan: ${_e(result.base.desc)}<br>
      ${users} pengguna × ${result.base.mbps} Mbps = <strong>${result.raw.toFixed(0)} Mbps</strong> (raw)<br>
      × quality factor ${BW_QUALITY[quality]} = <strong>${result.withQ.toFixed(0)} Mbps</strong><br>
      × redundansi ${redundancy} = <strong>${result.total.toFixed(0)} Mbps</strong><br>
      <span style="color:var(--green);">Rekomendasi: paket <strong>${result.recommended >= 1000 ? (result.recommended/1000)+'Gbps' : result.recommended+'Mbps'}</strong> atau lebih tinggi</span>
    </div>`;

  pushNTHistory('Bandwidth Calc', `${users} users, ${service}`, `Total: ${result.total.toFixed(0)}Mbps → Recommend: ${result.recommended}Mbps`);
  renderNTHistory();
}

/* ================================================================== */
/*  Init                                                                */
/* ================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('panel-ping')) return;

  renderNTHistory();

  /* Tab switching */
  document.querySelectorAll('.nt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nt-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.nt-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tool}`).classList.add('active');
    });
  });

  /* Clear history */
  document.getElementById('btnClearNTHistory').addEventListener('click', () => {
    localStorage.removeItem(NT_HISTORY_KEY);
    renderNTHistory();
  });

  /* ----- PING ----- */
  const pingLoadBtn = document.getElementById('pingLoadServers');
  pingLoadBtn?.addEventListener('click', () => {
    const servers = getServers();
    document.getElementById('pingTargets').value = servers.map(s => s.ip).join('\n');
    if (typeof showToast === 'function') showToast(`${servers.length} server dimuat.`, 'info');
  });

  document.getElementById('btnRunPing').addEventListener('click', async () => {
    const raw     = document.getElementById('pingTargets').value;
    const targets = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!targets.length) { if (typeof showToast === 'function') showToast('Masukkan minimal satu host.', 'error'); return; }
    const count = parseInt(document.getElementById('pingCount').value) || 8;
    await runPing(targets, count, document.getElementById('pingResult'));
  });

  /* ----- TRACEROUTE ----- */
  document.getElementById('btnRunTrace').addEventListener('click', async () => {
    const target = document.getElementById('traceTarget').value.trim();
    if (!target) { if (typeof showToast === 'function') showToast('Masukkan target host.', 'error'); return; }
    const maxHop = parseInt(document.getElementById('traceMaxHop').value) || 15;
    await runTraceroute(target, maxHop, document.getElementById('traceResult'));
  });

  /* ----- PORT SCANNER ----- */
  document.getElementById('psPreset').addEventListener('change', e => {
    document.getElementById('psCustomWrap').style.display = e.target.value === 'custom' ? '' : 'none';
  });

  document.getElementById('btnRunPS').addEventListener('click', async () => {
    const host   = document.getElementById('psHost').value.trim();
    if (!host) { if (typeof showToast === 'function') showToast('Masukkan target host.', 'error'); return; }
    const preset = document.getElementById('psPreset').value;
    let ports;
    if (preset === 'custom') {
      const raw = document.getElementById('psCustom').value;
      ports = raw.split(/,\s*/).map(Number).filter(p => p > 0 && p <= 65535);
      if (!ports.length) { if (typeof showToast === 'function') showToast('Format port tidak valid.', 'error'); return; }
    } else {
      ports = PORT_PRESETS[preset] || PORT_PRESETS.web;
    }
    await runPortScan(host, ports, document.getElementById('psResult'));
  });

  /* ----- DNS ----- */
  document.getElementById('btnRunDNS').addEventListener('click', async () => {
    const domain = document.getElementById('dnsTarget').value.trim();
    if (!domain) { if (typeof showToast === 'function') showToast('Masukkan domain.', 'error'); return; }
    const type = document.getElementById('dnsType').value;
    const srv  = document.getElementById('dnsServer').value;
    await runDNS(domain, type, srv, document.getElementById('dnsResult'));
  });

  /* ----- SSL ----- */
  document.getElementById('sslLoadDomains')?.addEventListener('click', () => {
    const servers = getServers();
    document.getElementById('sslTargets').value = servers.map(s => s.domain).join('\n');
    if (typeof showToast === 'function') showToast(`${servers.length} domain dimuat.`, 'info');
  });

  document.getElementById('btnRunSSL').addEventListener('click', async () => {
    const raw     = document.getElementById('sslTargets').value;
    const domains = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!domains.length) { if (typeof showToast === 'function') showToast('Masukkan minimal satu domain.', 'error'); return; }
    await runSSL(domains, document.getElementById('sslResult'));
  });

  /* ----- WHOIS ----- */
  document.getElementById('btnRunWhois').addEventListener('click', async () => {
    const domain = document.getElementById('whoisTarget').value.trim();
    if (!domain) { if (typeof showToast === 'function') showToast('Masukkan domain.', 'error'); return; }
    await runWhois(domain, document.getElementById('whoisResult'));
  });

  /* ----- BANDWIDTH ----- */
  document.getElementById('btnCalcBW').addEventListener('click', () => {
    const users  = parseInt(document.getElementById('bwUsers').value) || 50;
    const svc    = document.getElementById('bwService').value;
    const qual   = document.getElementById('bwQuality').value;
    const redund = document.getElementById('bwRedundancy').value;
    runBandwidth(users, svc, qual, redund, document.getElementById('bwResult'));
  });
});
