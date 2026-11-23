# ⬡ ServerWatch — IT Ops Monitoring Dashboard

> Aplikasi monitoring infrastruktur server berbasis web untuk tim **IT Operations** — tanpa backend, tanpa instalasi, langsung buka di browser.

---

## 📋 Daftar Isi

- [Tentang Aplikasi](#tentang-aplikasi)
- [Fitur Utama](#fitur-utama)
- [Struktur File](#struktur-file)
- [Cara Penggunaan](#cara-penggunaan)
- [Halaman & Modul](#halaman--modul)
  - [Dashboard](#1-dashboard--indexhtml)
  - [Analisis SNMP](#2-analisis-snmp--snmphtml)
  - [Maintenance Window](#3-maintenance-window--maintenancehtml)
  - [Network Tools](#4-network-tools--nettoolshtml)
  - [Tiket Insiden](#5-tiket-insiden--ticketshtml)
  - [Profil & Server](#6-profil--server--profilehtml)
- [Penyimpanan Data](#penyimpanan-data)
- [Teknologi](#teknologi)
- [Catatan Pengembangan](#catatan-pengembangan)

---

## Tentang Aplikasi

**ServerWatch** adalah dashboard monitoring infrastruktur yang dirancang khusus untuk kebutuhan sehari-hari tim IT Ops. Dibuat sepenuhnya dengan HTML, CSS, dan JavaScript murni — tidak memerlukan server backend, framework, atau koneksi internet.

Semua data (server, profil, tiket, maintenance window, riwayat analisis) disimpan di **localStorage** browser sehingga persisten antar sesi tanpa perlu database.

> ⚠️ Fitur ping, traceroute, port scan, DNS lookup, SSL check, dan WHOIS berjalan sebagai **simulasi deterministik** di sisi klien. Untuk penggunaan produksi, tools ini perlu diintegrasikan dengan backend/API nyata.

---

## Fitur Utama

| Kategori | Fitur |
|---|---|
| 📡 Monitoring | Live ping simulation, status badge, auto-refresh 15 detik |
| 🔬 Analisis SNMP | Form telemetri SNMP, engine analisis insiden, laporan 3-bagian |
| 🛠 Maintenance | Penjadwalan maintenance window, countdown timer, iCal export |
| 🌐 Network Tools | Ping, Traceroute, Port Scan, DNS, SSL, WHOIS, Bandwidth Calculator |
| 🎫 Tiket Insiden | Kanban board, SLA tracker, komentar, statistik MTR |
| 👤 Profil | Edit profil inline, manajemen server terpusat |
| 🌙 UI/UX | Dark theme, responsive, toast notifications, activity log |

---

## Struktur File

```
server-monitor/
│
├── index.html          # Dashboard utama (monitoring server)
├── snmp.html           # Halaman analisis insiden SNMP
├── maintenance.html    # Maintenance window & change management
├── nettools.html       # Kumpulan network diagnostic tools
├── tickets.html        # Incident ticket tracker (Kanban)
├── profile.html        # Profil IT Ops & manajemen server
│
├── style.css           # Semua styling (dark theme, responsive)
│
├── app.js              # Shared logic: storage, ping engine, shared UI
├── snmp.js             # SNMP analysis engine
├── maintenance.js      # Maintenance window logic
├── nettools.js         # Network tools (ping sim, DNS, SSL, dll)
├── tickets.js          # Ticket tracker & Kanban logic
│
└── README.md           # Dokumentasi ini
```

---

## Cara Penggunaan

### Prasyarat
- Browser modern (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+)
- Tidak perlu instalasi apapun
- Tidak perlu koneksi internet

### Menjalankan Aplikasi

**Opsi 1 — Buka langsung:**
```
Buka file  server-monitor/index.html  di browser
```

**Opsi 2 — Via Live Server (VS Code):**
```
Install ekstensi "Live Server" di VS Code
Klik kanan index.html → "Open with Live Server"
```

**Opsi 3 — Via Python HTTP Server:**
```bash
cd server-monitor
python -m http.server 8080
# Buka http://localhost:8080
```

**Opsi 4 — Via Node.js:**
```bash
cd server-monitor
npx serve .
# Buka URL yang ditampilkan
```

---

## Halaman & Modul

### 1. Dashboard — `index.html`

Halaman utama untuk memantau kondisi semua server secara real-time.

**Fitur:**
- **4 stat cards** — Total, Online, Offline, Warning (auto-update)
- **Tabel server** — Nama, Domain, IP, Jenis, Status badge + animasi pulse, Ping (ms + bar visual), Uptime
- **Ping manual** — Klik tombol `↺` untuk trigger ping ke server tertentu
- **Detail modal** — Info lengkap + histogram riwayat 20 ping terakhir
- **Filter & Search** — Filter by status, search by nama/domain/IP/jenis
- **Auto-refresh** — Setiap 15 detik, simulasi perubahan latensi dan timeout
- **Activity Log** — Mencatat setiap event: status change, ping manual, server baru/hapus
- **Live clock** — Jam dan tanggal real-time di topbar

---

### 2. Analisis SNMP — `snmp.html`

Tool analisis insiden berbasis data telemetri SNMP dengan output laporan terstruktur mengikuti format **Senior Network & System Administrator**.

**Input:**
| Field | Keterangan |
|---|---|
| Nama Server / IP | Bisa dipilih dari daftar server terdaftar |
| sysDescr / OS | Deskripsi sistem dari OID sysDescr |
| Versi SNMP | SNMPv1 / SNMPv2c / SNMPv3 |
| Waktu Polling | Timestamp pengambilan data |
| CPU (hrProcessorLoad) | Slider interaktif 0–100% |
| RAM (hrStorageUsed/Size) | Input + live gauge bar |
| Storage (hrStorageFixedDisk) | Format: `/dev/sda1: 180GB/200GB (90%)` |
| Network (ifTable) | Format: `eth0: UP, In: 850 Mbps, Out: 120 Mbps` |
| SNMP Trap | Pesan trap terbaru |
| Threshold | CPU/RAM/Storage — bisa dikustomisasi |

**Output Analisis (3 bagian):**
1. **Status & Ringkasan Kondisi** — Tingkat urgensi `NORMAL` / `WARNING` / `CRITICAL`
2. **Analisis Dugaan Penyebab** — Korelasi metrik (CPU spike + traffic, memory leak, dll)
3. **Langkah Pengecekan & Mitigasi** — Perintah SSH konkret, warning risiko

**Fitur tambahan:**
- 4 skenario demo insiden realistis (tombol ⚡ Demo)
- Tombol salin hasil ke clipboard (plain text)
- Tombol cetak (window.print)
- Riwayat 50 analisis terakhir tersimpan di localStorage

---

### 3. Maintenance Window — `maintenance.html`

Penjadwalan dan pelacakan maintenance window serta change management.

**Fitur:**
- **Form penjadwalan** — Judul, deskripsi, server terdampak (checkbox multi-select), waktu mulai/selesai, tipe, PIC, risk level, rollback plan
- **Countdown banner** — Real-time hitung mundur untuk MW yang akan dimulai dalam 24 jam
- **Status workflow** — `Scheduled` → `In Progress` → `Completed` / `Cancelled`
- **Risk badge** — Low / Medium / High / Critical
- **Change Log Timeline** — Visual timeline semua perubahan status
- **Export iCal** — Download file `.ics` untuk Google Calendar / Outlook / Apple Calendar
- **Filter & Search** — Filter per status, pencarian teks bebas

**Tipe perubahan yang didukung:**
`Planned Maintenance` · `Emergency Maintenance` · `Upgrade/Patch` · `Migration` · `Backup/Restore` · `Configuration Change` · `Hardware Replacement`

---

### 4. Network Tools — `nettools.html`

7 tools diagnostik jaringan dalam satu halaman bertab.

| Tool | Deskripsi |
|---|---|
| **⬤ Ping Checker** | Multi-host, pilih jumlah ping (4/8/16/32x), hasil: min/avg/max, jitter, packet loss, sparkline grafis per host |
| **⌁ Traceroute** | Hop-by-hop routing simulation, latency bar, hostname lookup, 3 probe per hop |
| **⊞ Port Scanner** | Preset (Web/Database/Mail/Remote/DNS) atau port kustom, status open/filtered/closed |
| **◎ DNS Lookup** | Record type: A/AAAA/MX/NS/TXT/CNAME/PTR/SOA/ALL — pilih DNS server (Google/Cloudflare/OpenDNS/Local) |
| **🔒 SSL/TLS Check** | Multi-domain, cek validity, hari tersisa, cipher suite, TLS version, HSTS status |
| **◇ WHOIS** | Registrar, tanggal register/expire, nameserver, DNSSEC, domain status |
| **▲ Bandwidth Estimator** | Kalkulasi kebutuhan bandwidth berdasarkan: jumlah user, jenis layanan, kualitas target, faktor redundansi |

Semua tool menyimpan **riwayat penggunaan** di localStorage.

---

### 5. Tiket Insiden — `tickets.html`

Sistem pelacakan insiden dengan tampilan **Kanban board** dan SLA tracking.

**Fitur:**
- **Kanban Board** — 4 kolom: Open / In Progress / Resolved / Closed
- **Priority system** — Critical 🔴 / High 🟠 / Medium 🟡 / Low 🟢 dengan color-coded left border
- **SLA Tracker** — Real-time countdown SLA per tiket, warning jika < 20% sisa, animasi badge jika breach
- **Komentar & Update** — Thread komentar per tiket (tersimpan di localStorage), update status dari modal
- **Filter multi-dimensi** — Filter by status + priority, full-text search by judul/ID/PIC
- **Statistik MTR** — Mean Time to Resolve, Resolution Rate, SLA Breach count, Critical incidents
- **Integrasi Dashboard** — Tiket critical/high otomatis masuk ke Activity Log di Dashboard

**Kategori insiden:**
`Network` · `Server/Hardware` · `Aplikasi` · `Database` · `Security` · `Backup/Recovery` · `Performance` · `Lainnya`

**SLA default per prioritas (dapat diubah saat buat tiket):**
| Prioritas | SLA Default |
|---|---|
| Critical | 1 jam |
| High | 4 jam |
| Medium | 8 jam |
| Low | 24 jam |

---

### 6. Profil & Server — `profile.html`

Manajemen identitas IT Ops dan daftar server infrastruktur.

**Profil:**
- Edit semua field inline: Nama, Username, Email, Divisi, Deskripsi
- Avatar dengan inisial otomatis dari nama (dapat diubah manual)
- Data tersinkron ke sidebar di semua halaman

**Manajemen Server:**
- **Tambah server** — Form dengan validasi: Nama, Domain (format check), IP (format IPv4 + duplicate check), Jenis, Lokasi/Rack, OS, Catatan
- **Edit server** — Modal edit dengan pre-fill semua field
- **Hapus server** — Dengan konfirmasi
- **Card view** — Tampilan kartu dengan semua info server

---

## Penyimpanan Data

Semua data disimpan di `localStorage` browser dengan key berikut:

| Key | Konten | Maks |
|---|---|---|
| `sw_servers` | Daftar server terdaftar | Tidak terbatas |
| `sw_profile` | Data profil IT Ops | 1 record |
| `sw_log` | Activity log dashboard | 200 entri |
| `sw_snmp_history` | Riwayat analisis SNMP | 50 entri |
| `sw_mw` | Maintenance windows | Tidak terbatas |
| `sw_mw_cl` | Change log timeline | 100 entri |
| `sw_tickets` | Tiket insiden | Tidak terbatas |
| `sw_nt_history` | Riwayat penggunaan network tools | 80 entri |

> Data default (5 sample server + 3 maintenance window + 4 tiket) akan dimuat otomatis saat pertama kali membuka aplikasi.

**Reset data:**
Buka DevTools browser → Application → Local Storage → hapus key yang diinginkan, atau jalankan di console:
```javascript
// Reset semua data ke default
['sw_servers','sw_profile','sw_log','sw_snmp_history','sw_mw','sw_mw_cl','sw_tickets','sw_nt_history']
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

---

## Teknologi

| Teknologi | Versi | Keterangan |
|---|---|---|
| HTML5 | — | Semantic markup, `datetime-local`, `range` input |
| CSS3 | — | CSS Variables, Grid, Flexbox, Animations, `backdrop-filter` |
| JavaScript | ES2020+ | Vanilla JS, `async/await`, localStorage API, Clipboard API |

**Tidak menggunakan:**
- Framework CSS (Bootstrap, Tailwind, dll)
- Framework JS (React, Vue, Angular, dll)
- Library eksternal apapun
- Build tool (Webpack, Vite, dll)
- Backend / API / Database

---

## Catatan Pengembangan

### Menambahkan Server Baru via Script
```javascript
// Di console browser
const servers = JSON.parse(localStorage.getItem('sw_servers') || '[]');
servers.push({
  id: 'srv_custom_' + Date.now(),
  name: 'Server Baru',
  domain: 'baru.company.com',
  ip: '192.168.1.100',
  type: 'Web',
  os: 'Ubuntu 22.04 LTS',
  location: 'DC Jakarta Rack-C1',
  notes: 'Server baru ditambahkan via script.',
  addedAt: Date.now()
});
localStorage.setItem('sw_servers', JSON.stringify(servers));
location.reload();
```

### Integrasi Backend (Opsional)
Untuk produksi dengan ping/traceroute/port scan nyata, ganti fungsi simulasi di [`nettools.js`](nettools.js) dengan pemanggilan API:
```javascript
// Contoh: ganti runPing() dengan fetch ke backend
async function runPing(targets, count, resultEl) {
  const res = await fetch('/api/ping', {
    method: 'POST',
    body: JSON.stringify({ targets, count }),
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  // render data...
}
```

### Kustomisasi Threshold SNMP Global
Edit nilai default di [`snmp.js`](snmp.js) baris `thCPU`, `thRAM`, `thStorage` di fungsi `analyzeSnmp()`, atau gunakan panel **Ambang Batas** yang tersedia di halaman Analisis SNMP.

---

## Lisensi

Proyek ini dibuat untuk keperluan internal IT Operations. Bebas dimodifikasi dan didistribusikan sesuai kebutuhan tim.

---

*ServerWatch — Built for IT Ops, by IT Ops* ⬡
