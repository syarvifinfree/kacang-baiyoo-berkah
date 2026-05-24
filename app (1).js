// ─── CONFIG ───────────────────────────────────────────────
const SUPABASE_URL = 'https://hpounwcurecejitftxpl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ejStt_s0v6R9gzF3pOojAA_Bpq2jzD6';
const HARGA_JUAL = 1600;
const MOTOR_NILAI = 6000000;

// ─── ROLE (owner = lo, mitra = ilham) ─────────────────────
let ROLE = localStorage.getItem('kbb_role') || null;

// ─── STATE ────────────────────────────────────────────────
let ST = {
  kas: 0, bank: 0, stok_kal: 0, gudang: 0,
  piutang: 0, hutang_sup: 4320000, dana_cad: 0,
  modal: 15000000, laba_akum: 0, laba_u: 0,
  motor_bayar: 0, motor_lunas: false,
  total_omzet: 0, total_hpp: 0,
  week_omzet: 0, week_laba: 0,
  setup: false
};
let OUTLETS = [];
let PRODUKSI = [];
let VISITS = [];
let KASBON = [];
let CLOSING = [];
let JURNAL = [];

// ─── SUPABASE HELPER ──────────────────────────────────────
async function sb(method, table, body = null, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=representation'
  };
  if (method === 'PATCH') headers['Prefer'] = 'return=representation';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getState() {
  const r = await sb('GET', 'state', null, '?id=eq.1');
  if (r && r.length) ST = r[0];
}
async function saveState(patch) {
  Object.assign(ST, patch);
  await sb('PATCH', 'state', patch, '?id=eq.1');
}

// ─── INIT ─────────────────────────────────────────────────
async function init() {
  if (!ROLE) {
    askRole();
    return;
  }
  showRole();
  setDates();
  await loadAll();
  renderAll();
}

function askRole() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:16px;';
  overlay.innerHTML = `
    <div style="font-size:32px">🥜</div>
    <div style="font-size:20px;font-weight:700;text-align:center">Kacang Baiyoo Berkah</div>
    <div style="font-size:14px;color:#6b6b6b;text-align:center">Siapa yang pakai aplikasi ini?</div>
    <button onclick="setRole('owner')" style="width:100%;max-width:280px;padding:14px;background:#1c1c1c;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">👑 Owner (Syarvi)</button>
    <button onclick="setRole('mitra')" style="width:100%;max-width:280px;padding:14px;background:#fff;color:#1c1c1c;border:1.5px solid #1c1c1c;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">🏍 Mitra (Ilham)</button>
  `;
  document.body.appendChild(overlay);
}

function setRole(role) {
  ROLE = role;
  localStorage.setItem('kbb_role', role);
  document.body.querySelector('[style*="position:fixed"]')?.remove();
  showRole();
  setDates();
  loadAll().then(renderAll);
}

function showRole() {
  const el = document.getElementById('top-role');
  el.textContent = ROLE === 'owner' ? '👑 Owner' : '🏍 Mitra';
  el.className = 'badge ' + (ROLE === 'owner' ? 'role-owner' : 'badge-blue');

  // Sembunyikan menu yang tidak relevan untuk mitra
  if (ROLE === 'mitra') {
    document.querySelectorAll('.nav-btn').forEach(b => {
      if (['Neraca', 'Closing', 'Jurnal'].includes(b.textContent)) b.style.display = 'none';
    });
  }
}

async function loadAll() {
  try {
    await getState();
    OUTLETS = await sb('GET', 'outlets', null, '?order=created_at.asc') || [];
    PRODUKSI = await sb('GET', 'produksi', null, '?order=created_at.desc&limit=20') || [];
    VISITS = await sb('GET', 'visits', null, '?order=created_at.desc&limit=50') || [];
    KASBON = await sb('GET', 'kasbon', null, '?order=created_at.desc') || [];
    CLOSING = await sb('GET', 'closing', null, '?order=created_at.desc&limit=10') || [];
    JURNAL = await sb('GET', 'jurnal', null, '?order=created_at.desc&limit=100') || [];
  } catch (e) {
    toast('Gagal koneksi ke database');
    console.error(e);
  }
}

// ─── HELPERS ──────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }
function daysSince(d) { if (!d) return 999; return Math.floor((new Date() - new Date(d)) / 86400000); }
function idr(n, short = false) {
  n = Math.round(n || 0);
  if (short && Math.abs(n) >= 1000000) return 'Rp' + (n / 1000000).toFixed(1) + 'jt';
  if (short && Math.abs(n) >= 1000) return 'Rp' + (n / 1000).toFixed(0) + 'rb';
  return 'Rp' + n.toLocaleString('id');
}
function v(id) { return document.getElementById(id)?.value || ''; }
function setv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function el(id) { return document.getElementById(id); }
function setText(id, txt, cls = null) {
  const e = el(id); if (!e) return;
  e.textContent = txt;
  if (cls) e.className = cls;
}
function setDates() {
  const t = today();
  ['pr-tgl', 'v-tgl', 'sup-tgl', 'hs-tgl', 'op-tgl', 'kb-tgl', 'no-tgl'].forEach(id => {
    const e = el(id); if (e && !e.value) e.value = t;
  });
}
function toast(msg, dur = 2500) {
  const t = el('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}
function kasbonAktif() { return KASBON.filter(k => !k.lunas).reduce((s, k) => s + (k.nom || 0), 0); }
function lastHPP() { return PRODUKSI.length ? PRODUKSI[0].hpp : 1150; }
function outletStokTotal() { return OUTLETS.reduce((s, o) => s + (o.stok || 0), 0); }

function gp(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  el('page-' + id).classList.add('active');
  btn.classList.add('active');
  renderAll();
}

function openModal(id) { el(id).classList.add('open'); }
function closeModal(id) { el(id).classList.remove('open'); }
function closeModalOut(e, id) { if (e.target.id === id) closeModal(id); }

async function addJurnal(tipe, ket, tgl = null) {
  const row = { tipe, keterangan: ket, tgl: tgl || today() };
  await sb('POST', 'jurnal', row);
  JURNAL.unshift(row);
}

// ─── RENDER ALL ───────────────────────────────────────────
function renderAll() {
  renderNeraca();
  renderMotor();
  renderKasbonList();
  renderOutlets();
  renderAlarm();
  renderVisitSelect();
  renderListProd();
  renderListVisit();
  renderListClosing();
  renderJurnal();
  updateClosingSum();

  el('top-tgl').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const needVisit = OUTLETS.filter(o => daysSince(o.last_visit) >= 7).length;
  const ok = ST.laba_u >= 0 && ST.piutang < 2000000 && needVisit === 0;
  const hBadge = el('top-health');
  hBadge.textContent = ok ? '✅ Sehat' : '⚠️ Cek';
  hBadge.className = 'badge ' + (ok ? 'badge-green' : 'badge-amber');
}

function renderNeraca() {
  setText('n-kas', idr(ST.kas, true));
  setText('n-bank', idr(ST.bank, true));
  setText('n-kal', ST.stok_kal + ' kaleng');
  setText('n-gudang', ST.gudang + ' bungkus');
  setText('n-outlet-stok', outletStokTotal() + ' bungkus');
  setText('n-piutang', idr(ST.piutang, true));
  setText('n-hsup', idr(ST.hutang_sup, true));
  setText('n-cad', idr(ST.dana_cad, true));
  setText('n-modal', idr(ST.modal, true));
  setText('n-laba', idr(ST.laba_akum, true));
  setText('n-labau', idr(ST.laba_u, true));
  setText('kb-kas', idr(ST.kas, true));
  setText('kb-bank', idr(ST.bank, true));
  setText('kb-hsup', idr(ST.hutang_sup, true));

  const needVisit = OUTLETS.filter(o => daysSince(o.last_visit) >= 7).length;
  function setk(id, ok, yes, no) {
    const e = el(id); if (!e) return;
    e.textContent = ok ? yes : no;
    e.className = 'badge ' + (ok ? 'badge-green' : 'badge-red');
  }
  setk('k1', ST.stok_kal >= 0 && ST.gudang >= 0, 'Aman', 'Cek stok');
  setk('k2', ST.piutang < 2000000, 'Aman', 'Numpuk');
  setk('k3', needVisit === 0, 'Semua oke', needVisit + ' outlet');
  setk('k4', ST.laba_u >= 0, 'Ada laba', 'Merugi');

  if (ST.setup) {
    const ss = el('setup-section'); if (ss) ss.style.display = 'none';
  }
}

function updateClosingSum() {
  setText('cl-omzet-week', idr(ST.week_omzet));
  setText('cl-laba-week', idr(ST.week_laba));
  setText('cl-labau', idr(ST.laba_u));
  setText('cl-kasbon', idr(kasbonAktif()));
}

// ─── SETUP SALDO AWAL ─────────────────────────────────────
async function simpanSetup() {
  if (ROLE !== 'owner') { toast('Hanya owner yang bisa setup'); return; }
  const patch = {
    kas: +v('s-kas') || 0,
    bank: +v('s-bank') || 0,
    stok_kal: +v('s-kal') || 0,
    gudang: +v('s-gudang') || 0,
    piutang: +v('s-piutang') || 0,
    hutang_sup: +v('s-hsup') || 4320000,
    dana_cad: +v('s-cad') || 0,
    setup: true
  };
  await saveState(patch);
  await addJurnal('setup', 'Saldo awal KBB dikunci');
  toast('✅ Saldo awal tersimpan & dikunci!');
  renderAll();
}

// ─── PRODUKSI ─────────────────────────────────────────────
function prevProd() {
  const kal = +v('pr-kal'), hkal = +v('pr-hkal') || 270000,
    bungkus = +v('pr-bungkus'), upah = +v('pr-upah') || 80, plastik = +v('pr-plastik') || 45;
  if (!kal || !bungkus) { el('prev-prod').classList.remove('show'); return; }
  const hppK = Math.round((kal * hkal) / bungkus);
  const totP = plastik * bungkus, totU = upah * bungkus, totKas = totP + totU;
  const hpp = hppK + upah + plastik, margin = HARGA_JUAL - hpp;
  setText('pp-kacang', idr(hppK));
  setText('pp-plastik-tot', idr(totP));
  setText('pp-upah-tot', idr(totU));
  setText('pp-kas', idr(totKas));
  setText('pp-hpp', idr(hpp));
  setText('pp-margin', idr(margin) + ' (' + Math.round(margin / HARGA_JUAL * 100) + '%)');
  el('prev-prod').classList.add('show');
}

async function simpanProduksi() {
  if (ROLE !== 'owner') { toast('Hanya owner yang bisa input produksi'); return; }
  const kal = +v('pr-kal'), hkal = +v('pr-hkal') || 270000,
    bungkus = +v('pr-bungkus'), upah = +v('pr-upah') || 80,
    plastik = +v('pr-plastik') || 45, tgl = v('pr-tgl');
  if (!kal || !bungkus) { toast('Isi kaleng dan hasil bungkus'); return; }
  if (ST.stok_kal < kal) { toast('Stok kaleng kurang! (ada: ' + ST.stok_kal + ')'); return; }
  const hpp = Math.round((kal * hkal) / bungkus) + upah + plastik;
  const totKas = (upah + plastik) * bungkus;
  if (ST.kas < totKas) { toast('Kas tidak cukup! Butuh: ' + idr(totKas)); return; }

  const row = { kal, hkal, bungkus, upah, plastik, hpp, tot_kas: totKas, tgl };
  await sb('POST', 'produksi', row);
  PRODUKSI.unshift(row);

  await saveState({
    stok_kal: ST.stok_kal - kal,
    gudang: ST.gudang + bungkus,
    kas: ST.kas - totKas
  });

  await addJurnal('produksi', `Produksi ${bungkus} bungkus dari ${kal} kaleng | HPP ${idr(hpp)}/bungkus | kas keluar ${idr(totKas, true)}`, tgl);
  setv('pr-kal', ''); setv('pr-bungkus', '');
  el('prev-prod').classList.remove('show');
  toast('✅ Produksi dicatat! ' + bungkus + ' bungkus masuk gudang');
  renderAll();
}

function renderListProd() {
  const e = el('list-prod');
  if (!PRODUKSI.length) { e.innerHTML = '<div class="empty">Belum ada produksi</div>'; return; }
  e.innerHTML = PRODUKSI.slice(0, 8).map(p => `
    <div class="card" style="margin-bottom:8px">
      <div class="row"><span class="row-label">Tanggal</span><span>${p.tgl}</span></div>
      <div class="row"><span class="row-label">Input → Output</span><span>${p.kal} kaleng → ${p.bungkus} bungkus</span></div>
      <div class="row"><span class="row-label">Kas keluar</span><span class="tr">${idr(p.tot_kas)}</span></div>
      <div class="row"><span class="row-label">HPP real/bungkus</span><span class="tr">${idr(p.hpp)}</span></div>
      <div class="row"><span class="row-label">Margin/bungkus</span><span class="tg">${idr(HARGA_JUAL - p.hpp)} (${Math.round((HARGA_JUAL - p.hpp) / HARGA_JUAL * 100)}%)</span></div>
    </div>`).join('');
}

// ─── OUTLET ───────────────────────────────────────────────
async function simpanOutlet() {
  const nama = v('no-nama').trim(), alamat = v('no-alamat').trim(), tgl = v('no-tgl');
  if (!nama) { toast('Isi nama warung'); return; }
  const row = { nama, alamat, stok: 0, last_visit: null, total_laku: 0, total_omzet: 0, tgl_mulai: tgl };
  const res = await sb('POST', 'outlets', row);
  if (res && res.length) OUTLETS.push(res[0]);
  setv('no-nama', ''); setv('no-alamat', '');
  closeModal('modal-outlet');
  await addJurnal('outlet', `Outlet baru: ${nama}`, tgl);
  toast('✅ Outlet ' + nama + ' ditambahkan');
  renderAll();
}

function renderOutlets() {
  const q = (v('search-outlet') || '').toLowerCase();
  const list = OUTLETS.filter(o => !q || o.nama.toLowerCase().includes(q) || (o.alamat || '').toLowerCase().includes(q));
  const total = OUTLETS.length;
  const alarm = OUTLETS.filter(o => daysSince(o.last_visit) >= 7).length;
  setText('outlet-sum', total + ' outlet aktif');
  setText('outlet-alarm-sum', alarm > 0 ? '⚠️ ' + alarm + ' perlu dikunjungi' : '✅ Semua sudah dikunjungi minggu ini');
  const e = el('list-outlet');
  if (!list.length) { e.innerHTML = '<div class="empty">Belum ada outlet</div>'; return; }
  e.innerHTML = list.map(o => {
    const d = daysSince(o.last_visit);
    const dotCls = d >= 7 ? 'dot-r' : d >= 5 ? 'dot-a' : 'dot-g';
    const badgeCls = d >= 7 ? 'badge-red' : d >= 5 ? 'badge-amber' : 'badge-green';
    const statusTxt = d >= 7 ? 'Kunjungi sekarang' : d >= 5 ? 'Segera kunjungi' : 'Sudah dikunjungi';
    return `<div class="outlet-card">
      <div class="outlet-head">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span class="dot ${dotCls}" style="margin-top:5px;flex-shrink:0"></span>
          <div><div class="outlet-name">${o.nama}</div><div class="outlet-addr">${o.alamat || '-'}</div></div>
        </div>
        <span class="badge ${badgeCls}">${statusTxt}</span>
      </div>
      <div class="row"><span class="row-label">Stok di warung</span><span class="tb">${o.stok} bungkus</span></div>
      <div class="row"><span class="row-label">Kunjungan terakhir</span><span>${o.last_visit || 'Belum pernah'} ${d < 999 ? '(' + d + ' hari lalu)' : ''}</span></div>
      <div class="row"><span class="row-label">Total laku</span><span class="tg">${o.total_laku} bungkus</span></div>
      <div class="row"><span class="row-label">Total omzet</span><span class="tg">${idr(o.total_omzet, true)}</span></div>
    </div>`;
  }).join('');
}

// ─── VISIT ────────────────────────────────────────────────
function renderAlarm() {
  const urgent = OUTLETS.filter(o => daysSince(o.last_visit) >= 7).sort((a, b) => daysSince(b.last_visit) - daysSince(a.last_visit));
  const e = el('alarm-list');
  if (!urgent.length) { e.innerHTML = '<div class="alert alert-ok">✅ Semua outlet sudah dikunjungi minggu ini</div>'; return; }
  e.innerHTML = urgent.map(o => {
    const d = daysSince(o.last_visit);
    return `<div class="outlet-card">
      <div class="outlet-head">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span class="dot dot-r" style="margin-top:5px;flex-shrink:0"></span>
          <div><div class="outlet-name">${o.nama}</div><div class="outlet-addr">${o.alamat || '-'}</div></div>
        </div>
        <span class="badge badge-red">${d < 999 ? d + ' hari lalu' : 'Belum pernah'}</span>
      </div>
      <div class="row"><span class="row-label">Stok di warung</span><span>${o.stok} bungkus</span></div>
    </div>`;
  }).join('');
}

function renderVisitSelect() {
  const sel = el('v-outlet');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- pilih warung --</option>' +
    OUTLETS.map((o, i) => `<option value="${i}" ${cur == i ? 'selected' : ''}>${o.nama}</option>`).join('');
}

function prevVisitOutlet() {
  const idx = v('v-outlet');
  const info = el('prev-v-info');
  if (!idx) { info.style.display = 'none'; return; }
  const o = OUTLETS[+idx];
  setText('pvi-stok', o.stok + ' bungkus');
  const d = daysSince(o.last_visit);
  setText('pvi-last', o.last_visit ? o.last_visit + ' (' + d + ' hari lalu)' : 'Belum pernah');
  info.style.display = 'block';
  calcVisit();
}

function calcVisit() {
  const idx = v('v-outlet');
  if (!idx || v('v-sisa') === '') { el('prev-visit').classList.remove('show'); return; }
  const o = OUTLETS[+idx];
  const sisa = +v('v-sisa'), refill = +v('v-refill') || 0;
  const laku = Math.max(0, o.stok - sisa);
  const omzet = laku * HARGA_JUAL;
  const hpp = lastHPP();
  const laba = laku * (HARGA_JUAL - hpp);
  setText('pv-laku', laku + ' bungkus');
  setText('pv-omzet', idr(omzet));
  setText('pv-laba', idr(laba));
  setText('pv-retur', sisa + ' bungkus kembali ke gudang Ilham');
  setText('pv-stok-baru', (sisa + refill) + ' bungkus');
  el('prev-visit').classList.add('show');
}

async function simpanVisit() {
  const idx = v('v-outlet');
  if (!idx) { toast('Pilih outlet dulu'); return; }
  if (v('v-sisa') === '') { toast('Isi sisa bungkus di warung'); return; }
  const o = OUTLETS[+idx];
  const sisa = +v('v-sisa'), refill = +v('v-refill') || 0, rusak = +v('v-rusak') || 0;
  const laku = Math.max(0, o.stok - sisa);
  const omzet = laku * HARGA_JUAL;
  const hpp = lastHPP();
  const laba = laku * (HARGA_JUAL - hpp);
  const bayarKe = v('v-bayar-ke'), bayarNom = +v('v-bayar-nom') || 0;
  const tgl = v('v-tgl');

  if (refill > ST.gudang) { toast('Stok gudang Ilham tidak cukup untuk refill! (ada: ' + ST.gudang + ')'); return; }

  // Update outlet di DB
  const newStok = sisa + refill - rusak;
  await sb('PATCH', 'outlets', {
    stok: newStok,
    last_visit: tgl,
    total_laku: (o.total_laku || 0) + laku,
    total_omzet: (o.total_omzet || 0) + omzet
  }, '?id=eq.' + o.id);

  // Update local
  OUTLETS[+idx] = { ...o, stok: newStok, last_visit: tgl, total_laku: (o.total_laku || 0) + laku, total_omzet: (o.total_omzet || 0) + omzet };

  // Save visit record
  const visitRow = {
    outlet_id: o.id, outlet_nama: o.nama,
    stok_awal: o.stok, sisa, laku, refill, rusak,
    omzet, laba, hpp, bayar_ke: bayarKe, bayar_nom: bayarNom, tgl
  };
  await sb('POST', 'visits', visitRow);
  VISITS.unshift(visitRow);

  // Update state
  const newGudang = ST.gudang - refill + sisa - rusak;
  const stPatch = {
    gudang: newGudang,
    total_omzet: ST.total_omzet + omzet,
    total_hpp: ST.total_hpp + laku * hpp,
    laba_akum: ST.laba_akum + laba,
    laba_u: ST.laba_u + laba,
    week_omzet: ST.week_omzet + omzet,
    week_laba: ST.week_laba + laba
  };
  if (bayarKe === 'kas') stPatch.kas = ST.kas + bayarNom;
  else if (bayarKe === 'bank') stPatch.bank = ST.bank + bayarNom;
  else if (bayarKe === 'bon') stPatch.piutang = ST.piutang + bayarNom;
  await saveState(stPatch);

  await addJurnal('visit', `Visit ${o.nama}: ${laku} laku | omzet ${idr(omzet, true)} | refill ${refill} bungkus`, tgl);

  setv('v-sisa', ''); setv('v-refill', ''); setv('v-bayar-nom', ''); setv('v-rusak', '0');
  el('prev-visit').classList.remove('show');
  el('prev-v-info').style.display = 'none';
  el('v-outlet').value = '';
  toast(`✅ Visit ${o.nama}: ${laku} bungkus laku | ${idr(omzet, true)}`);
  renderAll();
}

function renderListVisit() {
  const e = el('list-visit');
  if (!VISITS.length) { e.innerHTML = '<div class="empty">Belum ada visit</div>'; return; }
  e.innerHTML = VISITS.slice(0, 15).map(v => `
    <div class="card" style="margin-bottom:8px">
      <div class="row"><span class="row-label tb">${v.outlet_nama}</span><span style="color:var(--text3)">${v.tgl}</span></div>
      <div class="row"><span class="row-label">Laku</span><span class="tg tb">${v.laku} bungkus</span></div>
      <div class="row"><span class="row-label">Omzet</span><span class="tg">${idr(v.omzet)}</span></div>
      <div class="row"><span class="row-label">Sisa retur gudang</span><span class="ta">${v.sisa} bungkus</span></div>
      <div class="row"><span class="row-label">Refill dititip</span><span class="ti">${v.refill} bungkus</span></div>
      ${v.rusak ? `<div class="row"><span class="row-label">Rusak</span><span class="tr">${v.rusak} bungkus</span></div>` : ''}
      <div class="row"><span class="row-label">Bayar</span><span>${idr(v.bayar_nom)} → ${v.bayar_ke === 'bon' ? 'bon' : v.bayar_ke}</span></div>
    </div>`).join('');
}

// ─── CLOSING ──────────────────────────────────────────────
function prevBH() {
  const laba = +v('bh-input');
  if (!laba) { el('prev-bh').classList.remove('show'); return; }
  if (laba > ST.laba_u) { el('prev-bh').classList.remove('show'); return; }
  const lunas = ST.motor_lunas;
  const owner = Math.round(laba * (lunas ? 0.51 : 0.55));
  const mitra = Math.round(laba * (lunas ? 0.45 : 0.35));
  const motor = Math.round(lunas ? 0 : laba * 0.10);
  const cad = Math.round(lunas ? laba * 0.04 : 0);
  const pot = Math.min(kasbonAktif(), mitra);
  el('bh-bar').innerHTML = lunas
    ? `<div class="feseg" style="width:51%;background:#1c1c1c">Lo 51%</div><div class="feseg" style="width:45%;background:#5f5e5a">Ilham 45%</div><div class="feseg" style="width:4%;background:#888">4%</div>`
    : `<div class="feseg" style="width:55%;background:#1c1c1c">Lo 55%</div><div class="feseg" style="width:35%;background:#5f5e5a">Ilham 35%</div><div class="feseg" style="width:10%;background:#888">Mtr</div>`;
  setText('bh-owner', idr(owner));
  setText('bh-mitra', idr(mitra));
  setText('bh-pot', pot > 0 ? '-' + idr(pot) : '-');
  setText('bh-net', idr(mitra - pot));
  setText('bh-cicil', idr(motor));
  setText('bh-cad', idr(cad));
  el('prev-bh').classList.add('show');
}

async function simpanClosing() {
  if (ROLE !== 'owner') { toast('Hanya owner yang bisa closing'); return; }
  const pribadi = +v('cl-pribadi') || 0;
  const bhLaba = +v('bh-input') || 0;
  const ke = v('bh-ke');

  const patch = {};
  if (pribadi > 0) patch.kas = ST.kas + pribadi;

  let bhData = {};
  if (bhLaba > 0) {
    if (bhLaba > ST.laba_u) { toast('Melebihi laba tersedia (' + idr(ST.laba_u) + ')'); return; }
    const lunas = ST.motor_lunas;
    const owner = Math.round(bhLaba * (lunas ? 0.51 : 0.55));
    const mitra = Math.round(bhLaba * (lunas ? 0.45 : 0.35));
    const motor = Math.round(lunas ? 0 : bhLaba * 0.10);
    const cad = Math.round(lunas ? bhLaba * 0.04 : 0);
    const pot = Math.min(kasbonAktif(), mitra);

    // Lunaskan kasbon
    if (pot > 0) {
      let sisa = pot;
      for (const k of KASBON) {
        if (!k.lunas && sisa > 0) {
          await sb('PATCH', 'kasbon', { lunas: true }, '?id=eq.' + k.id);
          k.lunas = true;
          sisa -= k.nom;
        }
      }
    }

    if (ke === 'kas') patch.kas = (patch.kas || ST.kas) + owner;
    else patch.bank = ST.bank + owner;

    patch.motor_bayar = Math.min(MOTOR_NILAI, ST.motor_bayar + motor);
    patch.motor_lunas = patch.motor_bayar >= MOTOR_NILAI;
    patch.dana_cad = ST.dana_cad + cad;
    patch.laba_u = Math.max(0, ST.laba_u - bhLaba);

    bhData = { bh_laba: bhLaba, bh_owner: owner, bh_mitra: mitra, bh_motor: motor, bh_cad: cad, bh_pot: pot, bh_skema: lunas ? '51/45/4' : '55/35/10' };
  }

  // Save closing record
  const closingRow = {
    omzet_week: ST.week_omzet, laba_week: ST.week_laba,
    pribadi, tgl: today(), ...bhData
  };
  await sb('POST', 'closing', closingRow);
  CLOSING.unshift(closingRow);

  // Reset week counters
  patch.week_omzet = 0;
  patch.week_laba = 0;

  await saveState(patch);
  await addJurnal('closing', `Closing: omzet ${idr(ST.week_omzet, true)} | laba ${idr(ST.week_laba, true)}${bhLaba ? ' | bagi hasil ' + idr(bhLaba, true) : ''}`);

  setv('cl-pribadi', ''); setv('bh-input', '');
  el('prev-bh').classList.remove('show');
  toast('✅ Closing minggu ini tersimpan!');
  renderAll();
}

function renderMotor() {
  const sisa = Math.max(0, MOTOR_NILAI - ST.motor_bayar);
  const pct = Math.min(100, Math.round(ST.motor_bayar / MOTOR_NILAI * 100));
  setText('motor-bayar', idr(ST.motor_bayar, true));
  setText('motor-sisa', idr(sisa, true));
  el('motor-bar').style.width = pct + '%';
  const badge = el('motor-badge');
  badge.innerHTML = ST.motor_lunas
    ? '<span class="badge badge-green">✅ Lunas — skema 51/45/4%</span>'
    : `<span class="badge badge-amber">Belum lunas (${pct}%) — skema 55/35/10%</span>`;
}

function renderListClosing() {
  const e = el('list-closing');
  if (!CLOSING.length) { e.innerHTML = '<div class="empty">Belum ada closing</div>'; return; }
  e.innerHTML = CLOSING.slice(0, 6).map(c => `
    <div class="card" style="margin-bottom:8px">
      <div class="row"><span class="row-label">Tanggal</span><span>${c.tgl}</span></div>
      <div class="row"><span class="row-label">Omzet minggu</span><span class="tg">${idr(c.omzet_week)}</span></div>
      <div class="row"><span class="row-label">Laba minggu</span><span class="tg">${idr(c.laba_week)}</span></div>
      ${c.pribadi ? `<div class="row"><span class="row-label">Ganti uang pribadi</span><span class="ti">${idr(c.pribadi)}</span></div>` : ''}
      ${c.bh_laba ? `<div class="row"><span class="row-label">Bagi hasil</span><span class="badge badge-green">${idr(c.bh_laba, true)} | ${c.bh_skema}</span></div>` : ''}
    </div>`).join('');
}

// ─── KAS & BANK ───────────────────────────────────────────
async function beliKacang() {
  if (ROLE !== 'owner') { toast('Hanya owner yang bisa catat pembelian'); return; }
  const kal = +v('sup-kal'), hkal = +v('sup-hkal') || 270000,
    bayar = +v('sup-bayar') || 0, dari = v('sup-dari'), tgl = v('sup-tgl');
  if (!kal) { toast('Isi jumlah kaleng'); return; }
  const total = kal * hkal, hutangBaru = total - bayar;
  if (bayar > 0) {
    if (dari === 'kas' && ST.kas < bayar) { toast('Kas tidak cukup'); return; }
    if (dari === 'bank' && ST.bank < bayar) { toast('Saldo bank tidak cukup'); return; }
  }
  const patch = { stok_kal: ST.stok_kal + kal, hutang_sup: ST.hutang_sup + hutangBaru };
  if (bayar > 0) {
    if (dari === 'kas') patch.kas = ST.kas - bayar;
    else patch.bank = ST.bank - bayar;
  }
  await saveState(patch);
  await addJurnal('kas', `Beli ${kal} kaleng | total ${idr(total, true)} | bayar ${idr(bayar, true)} | hutang baru ${idr(hutangBaru, true)}`, tgl);
  setv('sup-kal', ''); setv('sup-bayar', '');
  toast(`✅ ${kal} kaleng dicatat! Hutang baru: ${idr(hutangBaru, true)}`);
  renderAll();
}

async function bayarSupplier() {
  if (ROLE !== 'owner') { toast('Hanya owner yang bisa bayar supplier'); return; }
  const nom = +v('hs-nom'), dari = v('hs-dari'), tgl = v('hs-tgl');
  if (!nom) { toast('Isi nominal'); return; }
  if (dari === 'kas' && ST.kas < nom) { toast('Kas tidak cukup'); return; }
  if (dari === 'bank' && ST.bank < nom) { toast('Saldo bank tidak cukup'); return; }
  const patch = { hutang_sup: Math.max(0, ST.hutang_sup - nom) };
  if (dari === 'kas') patch.kas = ST.kas - nom;
  else patch.bank = ST.bank - nom;
  await saveState(patch);
  await addJurnal('kas', `Bayar supplier ${idr(nom, true)} dari ${dari === 'kas' ? 'Kas' : 'Bank'}`, tgl);
  setv('hs-nom', '');
  toast('✅ Pembayaran supplier dicatat!');
  renderAll();
}

async function simpanOps() {
  if (ROLE !== 'owner') { toast('Hanya owner yang bisa catat pengeluaran'); return; }
  const nom = +v('op-nom'), dari = v('op-dari'), ket = v('op-ket'), tgl = v('op-tgl'), jenis = v('op-jenis');
  if (!nom) { toast('Isi nominal'); return; }
  if (dari === 'cad' && ST.dana_cad < nom) { toast('Dana cadangan tidak cukup (' + idr(ST.dana_cad) + ')'); return; }
  if (dari === 'kas' && ST.kas < nom) { toast('Kas tidak cukup'); return; }
  if (dari === 'bank' && ST.bank < nom) { toast('Saldo bank tidak cukup'); return; }
  const patch = {};
  if (dari === 'cad') patch.dana_cad = ST.dana_cad - nom;
  else if (dari === 'kas') patch.kas = ST.kas - nom;
  else patch.bank = ST.bank - nom;
  await saveState(patch);
  await addJurnal('kas', `${jenis}: ${ket || '-'} | ${idr(nom, true)} dari ${dari}`, tgl);
  setv('op-nom', ''); setv('op-ket', '');
  toast('✅ Pengeluaran dicatat!');
  renderAll();
}

// ─── KASBON ───────────────────────────────────────────────
async function simpanKasbon() {
  const nom = +v('kb-nom'), ket = v('kb-ket'), tgl = v('kb-tgl');
  if (!nom) { toast('Isi nominal'); return; }
  const row = { nom, ket: ket || 'Kasbon', tgl, lunas: false };
  const res = await sb('POST', 'kasbon', row);
  if (res && res.length) KASBON.unshift(res[0]);
  await addJurnal('kas', `Kasbon Ilham: ${ket || '-'} ${idr(nom, true)}`, tgl);
  setv('kb-nom', ''); setv('kb-ket', '');
  closeModal('modal-kasbon');
  toast('✅ Kasbon dicatat');
  renderAll();
}

async function lunasKasbon(id) {
  await sb('PATCH', 'kasbon', { lunas: true }, '?id=eq.' + id);
  const k = KASBON.find(k => k.id === id);
  if (k) k.lunas = true;
  toast('✅ Kasbon dilunasi');
  renderAll();
}

function renderKasbonList() {
  const total = kasbonAktif();
  setText('kb-kasbon-tot', idr(total));
  setText('cl-kasbon', idr(total));
  const e = el('list-kasbon');
  if (!KASBON.length) { e.innerHTML = '<div class="empty">Belum ada kasbon</div>'; return; }
  e.innerHTML = KASBON.map(k => `
    <div class="kb-item">
      <div>
        <div style="font-weight:500;font-size:13px">${k.ket}</div>
        <div style="font-size:11px;color:var(--text3)">${k.tgl}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${k.lunas ? 'badge-green' : 'badge-red'}">${k.lunas ? 'Lunas' : idr(k.nom, true)}</span>
        ${!k.lunas ? `<button class="btn btn-sm" onclick="lunasKasbon('${k.id}')">Lunas</button>` : ''}
      </div>
    </div>`).join('');
}

// ─── JURNAL ───────────────────────────────────────────────
function renderJurnal() {
  const q = (v('j-search') || '').toLowerCase();
  const f = v('j-filter');
  const list = JURNAL.filter(j => (!q || (j.keterangan || '').toLowerCase().includes(q)) && (!f || j.tipe === f));
  const e = el('list-jurnal');
  if (!list.length) { e.innerHTML = '<div class="empty">Tidak ada transaksi</div>'; return; }
  const tc = { produksi: 'badge-blue', visit: 'badge-green', closing: 'badge-green', kas: 'badge-amber', outlet: 'badge-gray', setup: 'badge-gray' };
  e.innerHTML = list.slice(0, 80).map(j => `
    <div class="j-item">
      <div style="flex:1;min-width:0">
        <div class="j-title">${j.keterangan || '-'}</div>
        <div class="j-meta">${j.tgl}</div>
      </div>
      <span class="badge ${tc[j.tipe] || 'badge-gray'}" style="flex-shrink:0;margin-left:6px">${j.tipe}</span>
    </div>`).join('');
}

// ─── RESET DATA ───────────────────────────────────────────
async function resetData() {
  if (ROLE !== 'owner') { toast('Hanya owner yang bisa reset data'); return; }
  const step1 = confirm('⚠️ HAPUS SEMUA DATA?\n\nIni akan menghapus:\n- Semua outlet\n- Semua visit\n- Semua produksi\n- Semua kasbon\n- Semua jurnal\n- Reset neraca ke nol\n\nLanjut?');
  if (!step1) return;
  const step2 = confirm('❗ YAKIN BANGET?\n\nData yang dihapus TIDAK BISA dikembalikan.\n\nKetik OK untuk konfirmasi.');
  if (!step2) return;

  toast('Menghapus data...');
  try {
    await sb('DELETE', 'visits', null, '?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE', 'kasbon', null, '?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE', 'closing', null, '?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE', 'jurnal', null, '?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE', 'produksi', null, '?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE', 'outlets', null, '?id=neq.00000000-0000-0000-0000-000000000000');
    await saveState({
      kas: 0, bank: 0, stok_kal: 0, gudang: 0,
      piutang: 0, hutang_sup: 4320000, dana_cad: 0,
      modal: 15000000, laba_akum: 0, laba_u: 0,
      motor_bayar: 0, motor_lunas: false,
      total_omzet: 0, total_hpp: 0,
      week_omzet: 0, week_laba: 0,
      setup: false
    });
    OUTLETS = []; PRODUKSI = []; VISITS = [];
    KASBON = []; CLOSING = []; JURNAL = [];
    toast('✅ Semua data berhasil dihapus!');
    renderAll();
  } catch (e) {
    toast('Gagal hapus data: ' + e.message);
    console.error(e);
  }
}

// ─── START ────────────────────────────────────────────────
init();
