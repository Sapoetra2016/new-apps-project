/* ============================================================
   ServerWatch — snmp.js
   SNMP Analysis Engine — form logic, incident analyser, history
   ============================================================ */

'use strict';

/* ------------------------------------------------------------------ */
/*  Demo dataset (skenario insiden realistis)                          */
/* ------------------------------------------------------------------ */
const DEMO_SCENARIOS = [
  {
    label: 'CRITICAL — CPU Spike + Traffic Flood',
    serverName: 'Web Server Utama',
    ip: '192.168.1.10',
    sysDescr: 'Linux Ubuntu 22.04.3 LTS x86_64 (Kernel 5.15.0-91)',
    snmpVersion: 'SNMPv2c',
    timestamp: _nowStr(),
    uptime: '14 hari 7 jam 22 menit',
    cpu: 97,
    ramUsed: 14.8,
    ramTotal: 16,
    storage: '/dev/sda1: 180GB/200GB (90%) | /dev/sdb1: 920GB/1TB (92%)',
    network: 'eth0: UP, In: 940 Mbps, Out: 870 Mbps | eth1: DOWN (linkDown trap received)',
    trap: 'linkDown on eth1 at ' + _nowStr() + ' | hrProcessorLoad exceeded 95% threshold | ifInOctets spike detected on eth0',
  },
  {
    label: 'WARNING — RAM Tinggi + Storage Mendekati Penuh',
    serverName: 'Database Server',
    ip: '192.168.1.20',
    sysDescr: 'CentOS Linux 7 (Core) x86_64 — MySQL 8.0.35',
    snmpVersion: 'SNMPv2c',
    timestamp: _nowStr(),
    uptime: '62 hari 3 jam 10 menit',
    cpu: 65,
    ramUsed: 30.2,
    ramTotal: 32,
    storage: '/dev/sda1: 85GB/100GB (85%) | /dev/sdb1: 1.8TB/2TB (90%)',
    network: 'eth0: UP, In: 210 Mbps, Out: 95 Mbps | eth1: UP, In: 5 Mbps, Out: 2 Mbps',
    trap: 'hrStorageUsed on /dev/sdb1 reached 90% at ' + _nowStr() + ' | RAM usage warning: 94%',
  },
  {
    label: 'NORMAL — Semua Metrik Dalam Batas',
    serverName: 'Mail Server',
    ip: '192.168.1.30',
    sysDescr: 'Debian GNU/Linux 11 (bullseye) x86_64 — Postfix 3.5.6',
    snmpVersion: 'SNMPv3',
    timestamp: _nowStr(),
    uptime: '30 hari 12 jam 5 menit',
    cpu: 18,
    ramUsed: 2.1,
    ramTotal: 8,
    storage: '/dev/sda1: 45GB/200GB (22%)',
    network: 'eth0: UP, In: 12 Mbps, Out: 8 Mbps',
    trap: '',
  },
  {
    label: 'CRITICAL — Server Down (Uptime Sangat Pendek + Timeout)',
    serverName: 'App Server Staging',
    ip: '192.168.2.10',
    sysDescr: 'Ubuntu 22.04.3 LTS x86_64 — Node.js / Docker',
    snmpVersion: 'SNMPv2c',
    timestamp: _nowStr(),
    uptime: '0 hari 0 jam 3 menit',
    cpu: 100,
    ramUsed: 15.9,
    ramTotal: 16,
    storage: '/dev/sda1: 199GB/200GB (99%)',
    network: 'eth0: DOWN | eth1: DOWN',
    trap: 'coldStart trap received at ' + _nowStr() + ' — perangkat baru saja restart | Storage /dev/sda1 hampir penuh (99%) | Semua interface DOWN',
  },
];

function _nowStr() {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

let _demoIdx = 0;

/* ------------------------------------------------------------------ */
/*  Escape helper (keep in scope, app.js may not be loaded yet when    */
/*  this runs — but DOMContentLoaded order means app.js runs first.   */
/*  Defined here as local fallback just in case.)                      */
/* ------------------------------------------------------------------ */
function _esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));
}

/* ------------------------------------------------------------------ */
/*  SNMP Analysis Engine                                                */
/* ------------------------------------------------------------------ */

/**
 * parseStorageEntries — parses storage string like
 * "/dev/sda1: 180GB/200GB (90%) | /dev/sdb1: 50GB/500GB (10%)"
 * Returns array of { mount, used, total, pct } objects.
 */
function parseStorageEntries(raw) {
  if (!raw || !raw.trim()) return [];
  const entries = [];
  const parts = raw.split(/\s*\|\s*/);
  parts.forEach(part => {
    // Try structured parse: "label: NGB/NGB (N%)"
    const m = part.match(/^(.+?):\s*([\d.]+)\s*([KMGT]?B)?\/\s*([\d.]+)\s*([KMGT]?B)?\s*\(([\d.]+)%\)/i);
    if (m) {
      entries.push({
        mount: m[1].trim(),
        usedRaw: parseFloat(m[2]),
        totalRaw: parseFloat(m[4]),
        pct: parseFloat(m[6]),
        raw: part.trim(),
      });
    } else {
      // Try to at least extract a percentage
      const pctM = part.match(/([\d.]+)%/);
      entries.push({
        mount: part.trim(),
        usedRaw: null,
        totalRaw: null,
        pct: pctM ? parseFloat(pctM[1]) : null,
        raw: part.trim(),
      });
    }
  });
  return entries;
}

/**
 * parseNetworkInterfaces — parses interface string like
 * "eth0: UP, In: 850 Mbps, Out: 120 Mbps | eth1: DOWN"
 */
function parseNetworkInterfaces(raw) {
  if (!raw || !raw.trim()) return [];
  const ifaces = [];
  raw.split(/\s*\|\s*/).forEach(part => {
    const nameM = part.match(/^(\S+):\s*(UP|DOWN)/i);
    if (!nameM) { ifaces.push({ name: part.trim(), status: 'unknown', inMbps: null, outMbps: null, raw: part.trim() }); return; }
    const inM  = part.match(/In:\s*([\d.]+)\s*Mbps/i);
    const outM = part.match(/Out:\s*([\d.]+)\s*Mbps/i);
    ifaces.push({
      name: nameM[1],
      status: nameM[2].toUpperCase(),
      inMbps: inM  ? parseFloat(inM[1])  : null,
      outMbps: outM ? parseFloat(outM[1]) : null,
      raw: part.trim(),
    });
  });
  return ifaces;
}

/**
 * levelOf — returns 'normal' | 'warning' | 'critical'
 */
function levelOf(value, warnTh, critTh) {
  if (value >= critTh)  return 'critical';
  if (value >= warnTh)  return 'warning';
  return 'normal';
}

/**
 * analyzeSnmp — core engine
 * Returns a structured result object used to build the report HTML.
 */
function analyzeSnmp(data, thresholds) {
  const { serverName, ip, sysDescr, snmpVersion, timestamp, uptime,
          cpu, ramUsed, ramTotal, storage, network, trap } = data;

  const thCPU     = thresholds.cpu     || 80;
  const thRAM     = thresholds.ram     || 85;
  const thStorage = thresholds.storage || 90;
  const critCPU   = Math.min(100, thCPU + 10);
  const critRAM   = Math.min(100, thRAM + 10);
  const critSt    = Math.min(100, thStorage + 10);

  // ---- Computed values ----
  const ramPct = ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0;
  const storageEntries = parseStorageEntries(storage);
  const ifaces = parseNetworkInterfaces(network);

  // ---- Severity per metric ----
  const cpuLevel  = levelOf(cpu, thCPU, critCPU);
  const ramLevel  = levelOf(ramPct, thRAM, critRAM);

  // Storage — worst entry
  let storageLevelWorst = 'normal';
  let storagePctWorst   = 0;
  let storageMountWorst = '—';
  storageEntries.forEach(e => {
    if (e.pct !== null && e.pct > storagePctWorst) {
      storagePctWorst = e.pct;
      storageMountWorst = e.mount;
    }
  });
  storageLevelWorst = levelOf(storagePctWorst, thStorage, critSt);

  // Network down interfaces
  const downIfaces = ifaces.filter(i => i.status === 'DOWN');
  const highTrafficIfaces = ifaces.filter(i =>
    i.status === 'UP' && (i.inMbps !== null && i.inMbps > 800 || i.outMbps !== null && i.outMbps > 800)
  );

  // Uptime — detect very recent restart
  const uptimeLow = uptime
    ? /0\s*hari.*0\s*jam.*[0-5]\s*menit|just reboot|restarted/i.test(uptime)
    : false;

  // Trap keywords
  const trapLower    = (trap || '').toLowerCase();
  const trapCritical = /linkdown|cold.?start|warm.?start|temperature.*exceed|disk.full|99%|100%/i.test(trap);
  const trapWarning  = /warning|threshold|high|spike|approaching/i.test(trap);

  // ---- Overall urgency ----
  const levels = [cpuLevel, ramLevel, storageLevelWorst];
  if (downIfaces.length > 0) levels.push('warning');
  if (downIfaces.length >= 2 || (downIfaces.length > 0 && cpu >= critCPU)) levels.push('critical');
  if (trapCritical || uptimeLow) levels.push('critical');
  if (trapWarning) levels.push('warning');

  const urgency = levels.includes('critical') ? 'critical'
                : levels.includes('warning')  ? 'warning'
                : 'normal';

  // ---- Build analysis sections ----

  /* 1. Status & Ringkasan */
  const metricsOverThreshold = [];
  if (cpuLevel !== 'normal')        metricsOverThreshold.push(`CPU <strong>${cpu}%</strong> (threshold ${thCPU}%)`);
  if (ramLevel !== 'normal')        metricsOverThreshold.push(`RAM <strong>${ramPct}%</strong> (${ramUsed} GB / ${ramTotal} GB, threshold ${thRAM}%)`);
  if (storageLevelWorst !== 'normal') metricsOverThreshold.push(`Storage <strong>${storagePctWorst}%</strong> pada <code>${storageMountWorst}</code> (threshold ${thStorage}%)`);
  if (downIfaces.length > 0)        metricsOverThreshold.push(`${downIfaces.length} interface <strong>DOWN</strong>: ${downIfaces.map(i => `<code>${i.name}</code>`).join(', ')}`);
  if (uptimeLow)                    metricsOverThreshold.push(`<strong>Uptime sangat rendah</strong> (${uptime || '—'}) — indikasi restart mendadak`);
  if (trapCritical && trap)         metricsOverThreshold.push(`SNMP Trap kritis terdeteksi`);

  const statusSummary = urgency === 'normal'
    ? `Semua metrik SNMP berada dalam batas normal. Server <strong>${_esc(serverName)}</strong> beroperasi stabil. Tidak ada anomali yang terdeteksi pada saat polling <strong>${_esc(timestamp)}</strong>.`
    : `Server <strong>${_esc(serverName)}</strong> (<code>${_esc(ip)}</code>) dalam status <strong>${urgency.toUpperCase()}</strong> pada polling <strong>${_esc(timestamp)}</strong>. Metrik yang melewati threshold: ${metricsOverThreshold.join(', ') || 'tidak ada yang terdeteksi dari data yang diberikan'}.`;

  /* 2. Analisis Dugaan Penyebab */
  const causes = [];

  if (cpu >= critCPU && highTrafficIfaces.length > 0) {
    causes.push({
      num: 'critical',
      text: `<strong>Korelasi CPU Critical + Saturasi Jaringan:</strong> CPU <code>${cpu}%</code> bersamaan dengan traffic inbound sangat tinggi (${highTrafficIfaces.map(i => `${i.name}: ${i.inMbps} Mbps`).join(', ')}) mengindikasikan kemungkinan <strong>DDoS, serangan brute-force, atau lonjakan request tidak wajar</strong>. Perlu pengecekan log akses segera.`,
    });
  } else if (cpu >= thCPU) {
    causes.push({
      num: cpuLevel,
      text: `<strong>Beban CPU Tinggi:</strong> CPU <code>${cpu}%</code> melebihi threshold. Tanpa data proses dari agent, kemungkinan penyebab: query database berat, build/kompilasi, atau proses runaway. <strong>Verifikasi via SSH</strong> menggunakan <code>top</code> / <code>htop</code> diperlukan.`,
    });
  }

  if (ramLevel !== 'normal') {
    const causeText = ramPct >= critRAM
      ? `<strong>RAM Kritis (${ramPct}%):</strong> Penggunaan RAM <code>${ramUsed} GB / ${ramTotal} GB</code>. Risiko tinggi sistem menggunakan swap disk secara intensif, yang dapat memperburuk performa lebih lanjut. Mungkin terjadi <strong>memory leak</strong> pada proses aplikasi atau lonjakan koneksi.`
      : `<strong>RAM Tinggi (${ramPct}%):</strong> Penggunaan RAM <code>${ramUsed} GB / ${ramTotal} GB</code> mendekati batas. Monitor tren dalam 15–30 menit ke depan untuk memastikan apakah sedang naik atau stabil.`;
    causes.push({ num: ramLevel, text: causeText });
  }

  if (storageLevelWorst !== 'normal') {
    causes.push({
      num: storageLevelWorst,
      text: `<strong>Storage ${storageMountWorst} Mendekati/Melampaui Kapasitas (${storagePctWorst}%):</strong> Disk penuh dapat menyebabkan <strong>gagal menulis log, crash proses, atau korupsi database</strong>. Kemungkinan penyebab: akumulasi log lama, backup tidak terhapus, atau pertumbuhan data tidak terkontrol.`,
    });
  }

  if (downIfaces.length > 0 && causes.length < 3) {
    causes.push({
      num: 'warning',
      text: `<strong>Interface DOWN (${downIfaces.map(i => i.name).join(', ')}):</strong> Dapat disebabkan oleh kabel fisik terlepas, switch port failure, atau misconfiguration NIC. Jika ini adalah interface redundan (bonding/failover), verifikasi apakah failover berjalan ke interface lain.`,
    });
  }

  if (uptimeLow && causes.length < 3) {
    causes.push({
      num: 'critical',
      text: `<strong>Uptime Sangat Rendah (${uptime || '—'}):</strong> Server baru saja restart (coldStart/warmStart trap terdeteksi) atau terjadi kernel panic. Perlu investigasi <strong>syslogs / kernel dmesg</strong> untuk mengetahui penyebab restart mendadak.`,
    });
  }

  if (trapCritical && causes.length < 3 && !causes.some(c => c.text.includes('Trap'))) {
    causes.push({
      num: 'critical',
      text: `<strong>SNMP Trap Kritis Diterima:</strong> Pesan trap: <em>"${_esc(trap)}"</em> — mengindikasikan event infrastruktur kritis yang perlu diinvestigasi segera.`,
    });
  }

  if (!causes.length) {
    causes.push({ num: 'normal', text: 'Tidak ada anomali signifikan yang terdeteksi dari korelasi data SNMP. Sistem beroperasi dalam batas normal.' });
  }

  /* 3. Langkah Pengecekan & Mitigasi */
  const steps = [];

  if (cpu >= thCPU) {
    steps.push({
      num: cpuLevel,
      text: `<strong>Identifikasi Proses Penyebab CPU Tinggi:</strong> Akses server via <code>SSH</code>, jalankan <code>top -b -n 1 | head -20</code> atau <code>ps aux --sort=-%cpu | head -10</code> untuk menemukan proses dengan konsumsi CPU tertinggi. Jika terkonfirmasi proses runaway, lakukan <code>kill -9 &lt;PID&gt;</code> setelah konfirmasi dengan tim terkait.<br><em>⚠ Hindari restart layanan tanpa koordinasi jika server merupakan produksi.</em>`,
    });
  }

  if (ramLevel !== 'normal') {
    steps.push({
      num: ramLevel,
      text: `<strong>Periksa Penggunaan Memori & Swap:</strong> Jalankan <code>free -h</code> dan <code>vmstat 1 5</code> untuk melihat kondisi RAM dan aktivitas swap. Periksa juga <code>cat /proc/meminfo | grep -i swap</code>. Jika swap aktif intensif, pertimbangkan untuk me-restart proses yang mengalami <strong>memory leak</strong> (konfirmasi dulu proses mana via <code>smem -s rss -r | head</code>).`,
    });
  }

  if (storageLevelWorst !== 'normal') {
    steps.push({
      num: storageLevelWorst,
      text: `<strong>Bersihkan Disk pada <code>${_esc(storageMountWorst)}</code>:</strong> Jalankan <code>du -sh /* 2>/dev/null | sort -rh | head -15</code> untuk menemukan direktori terbesar. Prioritas pembersihan: <code>/var/log</code> (log lama), <code>/tmp</code>, direktori backup kadaluarsa. <strong>JANGAN hapus file tanpa verifikasi</strong> — gunakan <code>ls -lth /path</code> untuk melihat tanggal file terlebih dahulu.`,
    });
  }

  if (downIfaces.length > 0 && steps.length < 3) {
    steps.push({
      num: 'warning',
      text: `<strong>Investigasi Interface DOWN (${downIfaces.map(i => `<code>${i.name}</code>`).join(', ')}):</strong> Periksa kondisi fisik kabel dan port switch. Di sisi OS (via SSH), jalankan <code>ip link show</code> dan <code>ethtool ${downIfaces[0].name}</code>. Jika merupakan interface bonding, cek status dengan <code>cat /proc/net/bonding/bond0</code>. Hubungi tim jaringan untuk koordinasi jika diperlukan perubahan konfigurasi switch.`,
    });
  }

  if (highTrafficIfaces.length > 0 && steps.length < 3) {
    steps.push({
      num: 'critical',
      text: `<strong>Mitigasi Saturasi Traffic (${highTrafficIfaces.map(i => i.name).join(', ')}):</strong> Jika dicurigai DDoS, aktifkan rate limiting di firewall/load balancer: <code>iptables -A INPUT -p tcp --dport 80 -m limit --limit 100/min --limit-burst 200 -j ACCEPT</code>. Periksa log akses web (<code>tail -f /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -10</code>) untuk menemukan IP sumber anomali.`,
    });
  }

  if (uptimeLow && steps.length < 3) {
    steps.push({
      num: 'critical',
      text: `<strong>Investigasi Penyebab Restart Mendadak:</strong> Setelah server dapat diakses via SSH, jalankan <code>last reboot</code> dan <code>journalctl -b -1 --no-pager | tail -50</code> (atau <code>dmesg | grep -E "panic|error|fail" | tail -20</code> untuk log kernel sebelum reboot). Ini krusial untuk mencegah kejadian berulang.`,
    });
  }

  if (!steps.length) {
    steps.push({ num: 'normal', text: 'Lanjutkan pemantauan rutin. Polling SNMP berikutnya sesuai interval yang dikonfigurasi (default: setiap 5 menit). Tidak ada tindakan darurat yang diperlukan saat ini.' });
  }

  // Destroy penyebab / langkah lebih dari 3
  const finalCauses = causes.slice(0, 3);
  const finalSteps  = steps.slice(0, 3);

  return {
    urgency,
    serverName, ip, sysDescr, snmpVersion, timestamp, uptime,
    cpu, cpuLevel,
    ramUsed, ramTotal, ramPct, ramLevel,
    storageEntries, storageLevelWorst, storagePctWorst, storageMountWorst,
    ifaces, downIfaces, highTrafficIfaces,
    thCPU, thRAM, thStorage,
    trap,
    statusSummary,
    causes: finalCauses,
    steps: finalSteps,
    analyzedAt: new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Render Result                                                       */
/* ------------------------------------------------------------------ */
function renderResult(r) {
  const urgencyLabels = { normal: '✔ NORMAL', warning: '⚠ WARNING', critical: '✕ CRITICAL' };
  const sectionIcons  = { status: '◉', causes: '◈', steps: '▶' };

  // Header
  const header = document.getElementById('resultHeader');
  header.className = `result-header level-${r.urgency}`;
  document.getElementById('resultUrgencyBadge').className = `result-urgency-badge ${r.urgency}`;
  document.getElementById('resultUrgencyBadge').textContent = urgencyLabels[r.urgency];
  document.getElementById('resultServerName').textContent = r.serverName || '—';
  document.getElementById('resultMeta').textContent =
    `${r.ip || '—'}  ·  ${r.sysDescr || '—'}  ·  ${r.snmpVersion}`;

  // Metric mini-cards
  document.getElementById('resultMetrics').innerHTML = `
    <div class="result-metric-item">
      <span class="rmi-label">CPU</span>
      <span class="rmi-value ${r.cpuLevel}">${r.cpu}%</span>
      <span class="rmi-sub">Threshold ${r.thCPU}%</span>
    </div>
    <div class="result-metric-item">
      <span class="rmi-label">RAM</span>
      <span class="rmi-value ${r.ramLevel}">${r.ramPct}%</span>
      <span class="rmi-sub">${r.ramUsed} / ${r.ramTotal} GB</span>
    </div>
    <div class="result-metric-item">
      <span class="rmi-label">Storage</span>
      <span class="rmi-value ${r.storageLevelWorst}">${r.storagePctWorst > 0 ? r.storagePctWorst + '%' : '—'}</span>
      <span class="rmi-sub">${_esc(r.storageMountWorst)}</span>
    </div>
    <div class="result-metric-item">
      <span class="rmi-label">Interface Down</span>
      <span class="rmi-value ${r.downIfaces.length > 0 ? 'warning' : 'normal'}">${r.downIfaces.length}</span>
      <span class="rmi-sub">dari ${r.ifaces.length} total</span>
    </div>
    <div class="result-metric-item">
      <span class="rmi-label">Uptime</span>
      <span class="rmi-value muted" style="font-size:.78rem;padding-top:.1rem;">${_esc(r.uptime || '—')}</span>
      <span class="rmi-sub">sysUpTime</span>
    </div>
  `;

  // Analysis body
  const bodyEl = document.getElementById('resultBody');
  bodyEl.innerHTML = `
    <!-- Section 1: Status -->
    <div class="result-section">
      <div class="result-section-title">
        <span class="result-section-icon">${sectionIcons.status}</span>
        1. Status &amp; Ringkasan Kondisi
      </div>
      <div class="result-status-summary">${r.statusSummary}</div>
    </div>

    <!-- Section 2: Causes -->
    <div class="result-section">
      <div class="result-section-title">
        <span class="result-section-icon">${sectionIcons.causes}</span>
        2. Analisis Dugaan Penyebab
      </div>
      <div class="result-points">
        ${r.causes.map((c, i) => `
          <div class="result-point">
            <span class="result-point-num ${c.num}">${i + 1}</span>
            <span>${c.text}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Section 3: Steps -->
    <div class="result-section">
      <div class="result-section-title">
        <span class="result-section-icon">${sectionIcons.steps}</span>
        3. Langkah Pengecekan &amp; Mitigasi Awal
      </div>
      <div class="result-points">
        ${r.steps.map((s, i) => `
          <div class="result-point">
            <span class="result-point-num accent">${i + 1}</span>
            <span>${s.text}</span>
          </div>
        `).join('')}
      </div>
    </div>

    ${r.urgency === 'critical' ? `
    <div class="result-risk-box">
      <span class="result-risk-icon">⚠</span>
      <span><strong>Peringatan Tindakan Destruktif:</strong> Jangan lakukan reboot paksa, format disk, atau penghentian layanan kritis tanpa verifikasi lanjutan dan koordinasi dengan tim terkait. Pastikan data telah dicek secara langsung via SSH/RDP sebelum mengambil tindakan permanen.</span>
    </div>` : ''}

    ${r.trap ? `
    <div class="result-section">
      <div class="result-section-title">◬ SNMP Trap / Alert</div>
      <div class="result-point" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:.6rem .8rem;font-family:'Cascadia Code','Consolas',monospace;font-size:.78rem;color:var(--yellow);">
        ${_esc(r.trap)}
      </div>
    </div>` : ''}
  `;

  // Footer
  document.getElementById('resultFooter').innerHTML = `
    <span>Polling: <strong>${_esc(r.timestamp)}</strong></span>
    <span>Dianalisis: ${r.analyzedAt}</span>
    <span>SNMP: ${_esc(r.snmpVersion)}</span>
  `;

  // Show card, hide placeholder
  document.getElementById('snmpResultPlaceholder').style.display = 'none';
  document.getElementById('snmpResultCard').style.display = '';

  // Scroll result into view on mobile
  if (window.innerWidth <= 1024) {
    document.getElementById('snmpResultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ------------------------------------------------------------------ */
/*  History                                                             */
/* ------------------------------------------------------------------ */
const HISTORY_KEY = 'sw_snmp_history';

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
}

function pushHistory(result) {
  const list = getHistory();
  list.unshift({
    id: 'snmp_' + Date.now(),
    urgency: result.urgency,
    serverName: result.serverName,
    ip: result.ip,
    cpu: result.cpu,
    ramPct: result.ramPct,
    storagePct: result.storagePctWorst,
    downIfaces: result.downIfaces.length,
    analyzedAt: result.analyzedAt,
    result: result, // store full result for re-open
  });
  saveHistory(list);
}

function renderHistory() {
  const list    = getHistory();
  const listEl  = document.getElementById('snmpHistoryList');
  if (!listEl) return;
  if (!list.length) {
    listEl.innerHTML = '<div class="log-empty">Belum ada riwayat analisis.</div>';
    return;
  }
  listEl.innerHTML = list.map(h => `
    <div class="snmp-history-item" data-id="${h.id}">
      <span class="shi-badge ${h.urgency}">${h.urgency.toUpperCase()}</span>
      <div class="shi-info">
        <div class="shi-name">${_esc(h.serverName || '—')}</div>
        <div class="shi-detail">
          ${_esc(h.ip || '—')} &nbsp;·&nbsp;
          CPU: ${h.cpu}% &nbsp;·&nbsp;
          RAM: ${h.ramPct}% &nbsp;·&nbsp;
          Storage: ${h.storagePct > 0 ? h.storagePct + '%' : '—'} &nbsp;·&nbsp;
          Down IF: ${h.downIfaces}
        </div>
      </div>
      <span class="shi-time">${_esc(h.analyzedAt)}</span>
      <span class="shi-open">↗</span>
    </div>
  `).join('');

  // Click to re-open result
  listEl.querySelectorAll('.snmp-history-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const entry = list.find(h => h.id === id);
      if (entry && entry.result) {
        renderResult(entry.result);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Copy result as plain text                                           */
/* ------------------------------------------------------------------ */
function buildPlainText(r) {
  const divider = '─'.repeat(60);
  const lines = [
    'LAPORAN ANALISIS SNMP — ServerWatch',
    divider,
    `Status         : ${r.urgency.toUpperCase()}`,
    `Server         : ${r.serverName} (${r.ip})`,
    `OS / sysDescr  : ${r.sysDescr || '—'}`,
    `SNMP Version   : ${r.snmpVersion}`,
    `Waktu Polling  : ${r.timestamp}`,
    `Uptime         : ${r.uptime || '—'}`,
    divider,
    'METRIK RESOURCE',
    `  CPU           : ${r.cpu}%  (threshold ${r.thCPU}%)  → ${r.cpuLevel.toUpperCase()}`,
    `  RAM           : ${r.ramPct}% (${r.ramUsed} GB / ${r.ramTotal} GB, threshold ${r.thRAM}%)  → ${r.ramLevel.toUpperCase()}`,
    `  Storage       : ${r.storagePctWorst}% pada ${r.storageMountWorst}  → ${r.storageLevelWorst.toUpperCase()}`,
    `  Interface Down: ${r.downIfaces.length} (${r.downIfaces.map(i => i.name).join(', ') || '—'})`,
    divider,
    '1. STATUS & RINGKASAN',
    r.statusSummary.replace(/<[^>]+>/g, ''),
    '',
    '2. ANALISIS DUGAAN PENYEBAB',
    ...r.causes.map((c, i) => `  ${i + 1}. ${c.text.replace(/<[^>]+>/g, '')}`),
    '',
    '3. LANGKAH PENGECEKAN & MITIGASI',
    ...r.steps.map((s, i) => `  ${i + 1}. ${s.text.replace(/<[^>]+>/g, '')}`),
  ];
  if (r.trap) {
    lines.push('', 'SNMP TRAP / ALERT', `  ${r.trap}`);
  }
  lines.push('', divider, `Dianalisis: ${r.analyzedAt}  |  ServerWatch IT Ops`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Form helpers                                                        */
/* ------------------------------------------------------------------ */
function fillForm(scenario) {
  document.getElementById('snmpServerName').value = scenario.serverName;
  document.getElementById('snmpIP').value          = scenario.ip;
  document.getElementById('snmpSysDescr').value    = scenario.sysDescr;
  document.getElementById('snmpVersion').value     = scenario.snmpVersion;
  document.getElementById('snmpTimestamp').value   = scenario.timestamp;
  document.getElementById('snmpUptime').value      = scenario.uptime;
  const slider = document.getElementById('snmpCPU');
  slider.value = scenario.cpu;
  document.getElementById('snmpCPUVal').textContent = scenario.cpu;
  updateSliderColor(slider);
  document.getElementById('snmpRAMUsed').value    = scenario.ramUsed;
  document.getElementById('snmpRAMTotal').value   = scenario.ramTotal;
  updateRAMGauge();
  document.getElementById('snmpStorage').value    = scenario.storage;
  document.getElementById('snmpNetwork').value    = scenario.network;
  document.getElementById('snmpTrap').value       = scenario.trap;
}

function clearForm() {
  document.getElementById('snmpForm').reset();
  document.getElementById('snmpCPUVal').textContent = '0';
  document.getElementById('ramPct').textContent = '—';
  const fill = document.getElementById('ramGaugeFill');
  fill.style.width = '0%';
  fill.className = 'resource-gauge-fill';
  updateSliderColor(document.getElementById('snmpCPU'));
}

function updateSliderColor(slider) {
  const val = parseInt(slider.value);
  const thCPU = parseInt(document.getElementById('thCPU')?.value || 80);
  const critCPU = Math.min(100, thCPU + 10);
  if (val >= critCPU)   slider.style.accentColor = 'var(--red)';
  else if (val >= thCPU) slider.style.accentColor = 'var(--yellow)';
  else                   slider.style.accentColor = 'var(--accent)';
}

function updateRAMGauge() {
  const used  = parseFloat(document.getElementById('snmpRAMUsed').value) || 0;
  const total = parseFloat(document.getElementById('snmpRAMTotal').value) || 1;
  const pct   = Math.min(100, Math.round((used / total) * 100));
  const thRAM = parseInt(document.getElementById('thRAM')?.value || 85);
  const critRAM = Math.min(100, thRAM + 10);
  const fill  = document.getElementById('ramGaugeFill');
  const pctEl = document.getElementById('ramPct');
  fill.style.width = pct + '%';
  fill.className = 'resource-gauge-fill' +
    (pct >= critRAM ? ' bad' : pct >= thRAM ? ' medium' : '');
  pctEl.textContent = pct + '%';
}

/* ------------------------------------------------------------------ */
/*  Populate server select from storage                                 */
/* ------------------------------------------------------------------ */
function populateServerSelect() {
  const select  = document.getElementById('snmpSelectServer');
  if (!select) return;
  const servers = getServers();  // from app.js
  servers.forEach(srv => {
    const opt = document.createElement('option');
    opt.value = srv.id;
    opt.textContent = `${srv.name} — ${srv.ip}`;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const id  = select.value;
    if (!id) return;
    const srv = servers.find(s => s.id === id);
    if (!srv) return;
    document.getElementById('snmpServerName').value = srv.name;
    document.getElementById('snmpIP').value          = srv.ip;
    if (srv.os) document.getElementById('snmpSysDescr').value = srv.os;
    document.getElementById('snmpTimestamp').value   = _nowStr();
    if (typeof showToast === 'function') {
      showToast(`Data "${srv.name}" dimuat ke form.`, 'info');
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Main init                                                           */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('snmpForm')) return;

  populateServerSelect();
  renderHistory();

  /* CPU slider */
  const cpuSlider = document.getElementById('snmpCPU');
  cpuSlider.addEventListener('input', () => {
    document.getElementById('snmpCPUVal').textContent = cpuSlider.value;
    updateSliderColor(cpuSlider);
  });

  /* RAM gauge live update */
  document.getElementById('snmpRAMUsed').addEventListener('input', updateRAMGauge);
  document.getElementById('snmpRAMTotal').addEventListener('input', updateRAMGauge);

  /* Demo button — cycles through scenarios */
  document.getElementById('btnFillDemo').addEventListener('click', () => {
    fillForm(DEMO_SCENARIOS[_demoIdx % DEMO_SCENARIOS.length]);
    _demoIdx++;
    if (typeof showToast === 'function') {
      showToast(`Demo "${DEMO_SCENARIOS[(_demoIdx - 1) % DEMO_SCENARIOS.length].label}" dimuat.`, 'info');
    }
  });

  /* Clear form */
  document.getElementById('btnClearForm').addEventListener('click', () => {
    clearForm();
  });

  /* Threshold toggle */
  const thresholdBody = document.getElementById('thresholdBody');
  const thresholdArrow = document.getElementById('thresholdArrow');
  document.getElementById('btnToggleThreshold').addEventListener('click', () => {
    const open = thresholdBody.style.display !== 'none';
    thresholdBody.style.display = open ? 'none' : 'block';
    thresholdArrow.classList.toggle('open', !open);
  });

  /* Copy result */
  let _lastResult = null;
  document.getElementById('btnCopyResult').addEventListener('click', () => {
    if (!_lastResult) return;
    const text = buildPlainText(_lastResult);
    navigator.clipboard.writeText(text).then(() => {
      if (typeof showToast === 'function') showToast('Hasil analisis disalin ke clipboard.', 'success');
    }).catch(() => {
      if (typeof showToast === 'function') showToast('Gagal menyalin — coba manual.', 'error');
    });
  });

  /* Print result */
  document.getElementById('btnPrintResult').addEventListener('click', () => {
    window.print();
  });

  /* Clear history */
  document.getElementById('btnClearHistory').addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    if (typeof showToast === 'function') showToast('Riwayat analisis dibersihkan.', 'info');
  });

  /* Form submit — run analysis */
  document.getElementById('snmpForm').addEventListener('submit', e => {
    e.preventDefault();

    // Validate required fields
    let valid = true;
    const name = document.getElementById('snmpServerName').value.trim();
    const ip   = document.getElementById('snmpIP').value.trim();
    const ts   = document.getElementById('snmpTimestamp').value.trim();
    const storage = document.getElementById('snmpStorage').value.trim();
    const ramUsed = parseFloat(document.getElementById('snmpRAMUsed').value);
    const ramTotal = parseFloat(document.getElementById('snmpRAMTotal').value);

    document.getElementById('snmpErrName').textContent    = '';
    document.getElementById('snmpErrIP').textContent      = '';
    document.getElementById('snmpErrTimestamp').textContent = '';
    document.getElementById('snmpErrStorage').textContent = '';
    document.getElementById('snmpErrRAM').textContent     = '';

    if (!name)    { document.getElementById('snmpErrName').textContent    = 'Nama server wajib diisi.'; valid = false; }
    if (!ip)      { document.getElementById('snmpErrIP').textContent      = 'IP address wajib diisi.'; valid = false; }
    if (!ts)      { document.getElementById('snmpErrTimestamp').textContent = 'Waktu polling wajib diisi.'; valid = false; }
    if (!storage) { document.getElementById('snmpErrStorage').textContent = 'Detail storage wajib diisi.'; valid = false; }
    if (isNaN(ramUsed) || isNaN(ramTotal)) {
      document.getElementById('snmpErrRAM').textContent = 'RAM digunakan & total wajib diisi.'; valid = false;
    } else if (ramUsed > ramTotal) {
      document.getElementById('snmpErrRAM').textContent = 'RAM digunakan tidak boleh melebihi RAM total.'; valid = false;
    }
    if (!valid) return;

    // Animate button
    const btn = document.getElementById('btnAnalyze');
    const btnText = document.getElementById('analyzeBtnText');
    btn.classList.add('loading');
    btnText.textContent = '⏳ Menganalisis…';
    btn.disabled = true;

    // Small artificial delay so user sees the loading state
    setTimeout(() => {
      const data = {
        serverName: name,
        ip,
        sysDescr:    document.getElementById('snmpSysDescr').value.trim(),
        snmpVersion: document.getElementById('snmpVersion').value,
        timestamp:   ts,
        uptime:      document.getElementById('snmpUptime').value.trim(),
        cpu:         parseInt(document.getElementById('snmpCPU').value) || 0,
        ramUsed,
        ramTotal,
        storage,
        network:     document.getElementById('snmpNetwork').value.trim(),
        trap:        document.getElementById('snmpTrap').value.trim(),
      };
      const thresholds = {
        cpu:     parseInt(document.getElementById('thCPU').value) || 80,
        ram:     parseInt(document.getElementById('thRAM').value) || 85,
        storage: parseInt(document.getElementById('thStorage').value) || 90,
      };

      const result = analyzeSnmp(data, thresholds);
      _lastResult  = result;

      renderResult(result);
      pushHistory(result);
      renderHistory();

      if (typeof pushLog === 'function') {
        pushLog(result.urgency === 'normal' ? 'info' : result.urgency,
          `Analisis SNMP: ${name} (${ip}) — ${result.urgency.toUpperCase()}`);
      }
      if (typeof showToast === 'function') {
        const toastType = result.urgency === 'normal' ? 'success'
                        : result.urgency === 'warning' ? 'warning' : 'error';
        showToast(`Analisis selesai: ${result.urgency.toUpperCase()} — ${name}`, toastType);
      }

      btn.classList.remove('loading');
      btnText.textContent = '▶ Jalankan Analisis';
      btn.disabled = false;
    }, 700);
  });
});
