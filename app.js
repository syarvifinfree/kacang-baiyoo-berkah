// ─── CONFIG ───────────────────────────────────────────────
const SUPABASE_URL = 'https://hpounwcurecejitftxpl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ejStt_s0v6R9gzF3pOojAA_Bpq2jzD6';
const HARGA_JUAL = 1600;
const MOTOR_NILAI = 6000000;

let ROLE = null, USER = null;
let ST = {
  kas:0,bank:0,stok_kal:0,gudang:0,piutang:0,hutang_sup:4320000,
  dana_cad:0,modal:15000000,laba_akum:0,laba_u:0,
  motor_bayar:0,motor_lunas:false,
  total_omzet:0,total_hpp:0,week_omzet:0,week_laba:0,setup:false,
  utang_owner:0,utang_upah:0
};
let OUTLETS=[],PRODUKSI=[],VISITS=[],KASBON=[],CLOSING=[],JURNAL=[];
let _visitLimit=30;
let _ruteSearch='';

// ─── SUPABASE ─────────────────────────────────────────────
async function sb(method,table,body=null,query=''){
  const url=`${SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers={
    'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,
    'Content-Type':'application/json','Prefer':'return=representation'
  };
  const res=await fetch(url,{method,headers,body:body?JSON.stringify(body):null});
  if(!res.ok){const e=await res.text();throw new Error(e);}
  const t=await res.text();return t?JSON.parse(t):null;
}
async function getState(){const r=await sb('GET','state',null,'?id=eq.1');if(r&&r.length)ST=r[0];}
async function saveState(patch){Object.assign(ST,patch);await sb('PATCH','state',patch,'?id=eq.1');}

// ─── HELPERS ──────────────────────────────────────────────
function today(){return new Date().toISOString().split('T')[0];}
function daysSince(d){if(!d)return 999;return Math.floor((new Date()-new Date(d))/86400000);}
function idr(n,s=false){
  n=Math.round(n||0);
  if(s&&Math.abs(n)>=1000000)return'Rp'+(n/1000000).toFixed(3).replace(/\.?0+$/,'')+'jt';
  if(s&&Math.abs(n)>=1000)return'Rp'+n.toLocaleString('id');
  return'Rp'+n.toLocaleString('id');
}
function v(id){return document.getElementById(id)?.value||'';}
function setv(id,val){const e=document.getElementById(id);if(e)e.value=val;}
function el(id){return document.getElementById(id);}
function setText(id,txt){const e=el(id);if(e)e.textContent=txt;}
function setDates(){
  const t=today();
  ['pr-tgl','v-tgl','sup-tgl','hs-tgl','op-tgl','kb-tgl','no-tgl','sk-tgl','mv-tgl'].forEach(id=>{
    const e=el(id);if(e&&!e.value)e.value=t;
  });
}
function toast(msg,dur=2500){
  const t=el('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),dur);
}
function kasbonAktif(){return KASBON.filter(k=>!k.lunas).reduce((s,k)=>s+(k.nom||0),0);}
function outletStokTotal(){return OUTLETS.reduce((s,o)=>s+(o.stok||0),0);}
function lastHPP(){return PRODUKSI.length?PRODUKSI[0].hpp:1150;}
function kedaiStokTotal(){return OUTLETS.reduce((s,o)=>s+(o.stok||0),0);}

function gp(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  el('page-'+id).classList.add('active');
  if(btn)btn.classList.add('active');
  renderAll();
  setTimeout(()=>{
    window.scrollTo(0,0);
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    const app=document.querySelector('.app');
    if(app)app.scrollTop=0;
  },0);
}
function openModal(id){el(id).classList.add('open');}
function closeModal(id){el(id).classList.remove('open');}
function closeModalOut(e,id){if(e.target.id===id)closeModal(id);}

async function addJurnal(tipe,ket,tgl=null,mutasi=null){
  // mutasi (opsional): {akun:'kas'|'bank', masuk:0, keluar:0}
  const row={tipe,keterangan:ket,tgl:tgl||today(),oleh:USER?USER.nama:'-'};
  if(mutasi){
    row.akun=mutasi.akun||null;
    row.masuk=mutasi.masuk||0;
    row.keluar=mutasi.keluar||0;
  }
  await sb('POST','jurnal',row);
  JURNAL.unshift(row);
}

// ─── RIWAYAT MUTASI KAS / BANK ────────────────────────────
let _mutasiAkun='kas';

function bukaRiwayatMutasi(akun){
  _mutasiAkun=akun||'kas';
  openModal('modal-mutasi');
  switchMutasiTab(_mutasiAkun);
}

function switchMutasiTab(akun){
  _mutasiAkun=akun;
  const kasBtn=el('mut-tab-kas'),bankBtn=el('mut-tab-bank');
  if(kasBtn){
    kasBtn.style.borderBottomColor=akun==='kas'?'var(--text)':'transparent';
    kasBtn.style.color=akun==='kas'?'var(--text)':'var(--text3)';
    kasBtn.style.fontWeight=akun==='kas'?'600':'500';
  }
  if(bankBtn){
    bankBtn.style.borderBottomColor=akun==='bank'?'var(--text)':'transparent';
    bankBtn.style.color=akun==='bank'?'var(--text)':'var(--text3)';
    bankBtn.style.fontWeight=akun==='bank'?'600':'500';
  }
  setText('mut-title',akun==='kas'?'💵 Riwayat Uang Kas':'🏦 Riwayat Bank Mandiri');
  setText('mut-saldo',idr(akun==='kas'?ST.kas:ST.bank));
  renderMutasi();
}

function renderMutasi(){
  const e=el('mut-list');
  if(!e)return;
  const akun=_mutasiAkun;
  const saldoNow=akun==='kas'?ST.kas:ST.bank;
  // Filter: pakai field akun kalau ada, fallback ke deteksi teks untuk jurnal lama
  const list=JURNAL.filter(j=>{
    if(j.akun!==undefined&&j.akun!==null)return j.akun===akun;
    // Fallback jurnal lama (tanpa field akun)
    const t=(j.tipe||'').toLowerCase(), k=(j.keterangan||'').toLowerCase();
    if(akun==='kas')return ['kas','visit','closing','setup'].includes(t)&&!k.includes('dari bank')&&!k.includes('→ mandiri');
    return k.includes('mandiri')||k.includes('dari bank')||k.includes('tf');
  });
  if(!list.length){
    e.innerHTML='<div class="alert alert-info">Belum ada transaksi</div>';
    return;
  }
  // Hitung saldo berjalan: mulai dari saldo sekarang, mundur ke belakang
  // JURNAL urut terbaru dulu. Saldo setelah transaksi teratas = saldoNow.
  let saldoBerjalan=saldoNow;
  const rows=[];
  for(const j of list){
    const masuk=j.masuk||0, keluar=j.keluar||0;
    const saldoSetelah=saldoBerjalan;  // saldo SETELAH transaksi ini
    rows.push({j,masuk,keluar,saldo:saldoSetelah});
    // Mundur: saldo sebelum transaksi ini = saldo setelah - masuk + keluar
    saldoBerjalan=saldoBerjalan-masuk+keluar;
  }
  e.innerHTML=rows.map(r=>{
    const j=r.j, k=j.keterangan||'';
    const punyaMutasi=(r.masuk>0||r.keluar>0);
    let badge='';
    if(r.masuk>0)badge=`<span style="font-size:12px;font-weight:700;color:#16a34a;white-space:nowrap">+${idr(r.masuk)}</span>`;
    else if(r.keluar>0)badge=`<span style="font-size:12px;font-weight:700;color:#dc2626;white-space:nowrap">−${idr(r.keluar)}</span>`;
    else badge=`<span style="font-size:10px;color:#9ca3af;white-space:nowrap">catatan</span>`;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
        <div style="flex:1">
          <div style="font-size:13px;color:var(--text);line-height:1.4">${k}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${j.tgl||''}${j.oleh&&j.oleh!=='-'?' · '+j.oleh:''}${punyaMutasi?' · saldo '+idr(r.saldo):''}</div>
        </div>
        ${badge}
      </div>
    </div>`;
  }).join('');
}

// ─── LOGIN ────────────────────────────────────────────────
function showLogin(){el('login-screen').style.display='flex';el('app-screen').style.display='none';}
function showApp(){el('login-screen').style.display='none';el('app-screen').style.display='block';}

async function doLogin(){
  const pin=v('login-pin');
  if(!pin){toast('Masukkan PIN');return;}
  try{
    const users=await sb('GET','users',null,`?pin=eq.${pin}`);
    if(!users||!users.length){
      el('login-error').textContent='PIN salah. Coba lagi.';
      setv('login-pin','');
      el('pin-dots').innerHTML='<span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>';
      return;
    }
    USER=users[0];ROLE=USER.role;
    sessionStorage.setItem('kbb_user',JSON.stringify(USER));
    el('login-error').textContent='';
    showApp();setupNav();setDates();
    await loadAll();renderAll();
  }catch(e){el('login-error').textContent='Gagal koneksi. Coba lagi.';console.error(e);}
}

function doLogout(){
  if(!confirm('Yakin mau logout?'))return;
  sessionStorage.removeItem('kbb_user');
  USER=null;ROLE=null;
  OUTLETS=[];PRODUKSI=[];VISITS=[];KASBON=[];CLOSING=[];JURNAL=[];
  setv('login-pin','');showLogin();
}

async function gantiPin(){
  if(!confirm('Ganti PIN kamu?'))return;
  const pinBaru=prompt('Masukkan PIN baru (4 angka):');
  if(!pinBaru||!/^\d{4}$/.test(pinBaru)){alert('PIN harus tepat 4 angka');return;}
  await sb('PATCH','users',{pin:pinBaru},`?id=eq.${USER.id}`);
  USER.pin=pinBaru;
  sessionStorage.setItem('kbb_user',JSON.stringify(USER));
  toast('✅ PIN berhasil diganti!');
}

function pinInput(val){
  const cur=v('login-pin');
  if(val==='del'){setv('login-pin',cur.slice(0,-1));}
  else if(cur.length<4){setv('login-pin',cur+val);}
  const pin=v('login-pin');
  el('pin-dots').innerHTML=pin.split('').map(()=>'<span class="pin-dot filled"></span>').join('')+
    Array(4-pin.length).fill('<span class="pin-dot"></span>').join('');
  // Auto-login saat 4 digit terisi
  if(pin.length===4)setTimeout(doLogin,150);
}

function setupNav(){
  // Semua tab visible untuk semua role
}

// ─── LOAD DATA ────────────────────────────────────────────
async function loadAll(){
  try{
    await getState();
    OUTLETS=await sb('GET','outlets',null,'?order=created_at.asc')||[];
    PRODUKSI=await sb('GET','produksi',null,'?order=created_at.desc&limit=50')||[];
    VISITS=await sb('GET','visits',null,'?order=created_at.desc&limit=2000')||[];
    KASBON=await sb('GET','kasbon',null,'?order=created_at.desc')||[];
    CLOSING=await sb('GET','closing',null,'?order=created_at.desc&limit=50')||[];
    JURNAL=await sb('GET','jurnal',null,'?order=created_at.desc&limit=2000')||[];
    // Sinkronkan ST.piutang dengan total piutang real semua outlet
    const piutangReal=OUTLETS.reduce((s,o)=>s+(o.piutang||0),0);
    if(ST.piutang!==piutangReal){
      ST.piutang=piutangReal;
      await saveState({piutang:piutangReal});
    }
  }catch(e){toast('Gagal koneksi ke database');console.error(e);}
}

// ─── RENDER ALL ───────────────────────────────────────────
function renderAll(){
  if(!USER)return;
  const activePage=document.querySelector('.page.active')?.id||'';
  renderNeraca();renderMotor();renderKasbonList();updateClosingSum();
  if(activePage==='page-outlet')renderOutlets();
  if(activePage==='page-visit'){renderAlarm();if(!el('modal-visit')?.classList.contains('open'))renderModeNgampas();renderListVisit();}
  if(el('modal-daftar-bon')&&el('modal-daftar-bon').classList.contains('open'))renderDaftarBon();
  if(activePage==='page-produksi')renderListProd();
  if(activePage==='page-closing')renderListClosing();
  if(activePage==='page-jurnal')renderJurnal();
  // Always render these for nav indicators
  if(activePage==='page-neraca'){renderOutlets();renderAlarm();}
  setText('top-tgl',new Date().toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'}));
  setText('top-user',USER?USER.nama:'-');
  const needVisit=OUTLETS.filter(o=>daysSince(o.last_visit)>=7).length;
  const ok=ST.laba_u>=0&&outletPiutangTotal()<2000000&&needVisit===0;
  const hBadge=el('top-health');
  hBadge.textContent=ok?'✅ Sehat':'⚠️ Cek';
  hBadge.className='badge '+(ok?'badge-green':'badge-amber');
}

// ─── NERACA ───────────────────────────────────────────────
function outletPiutangTotal(){return OUTLETS.reduce((s,o)=>s+(o.piutang||0),0);}

function renderNeraca(){
  setText('n-kas',idr(ST.kas,true));setText('n-bank',idr(ST.bank,true));
  setText('n-kal',ST.stok_kal+' kaleng');setText('n-gudang',ST.gudang+' bungkus');
  setText('kg-app',ST.gudang+' bungkus');
  setText('n-outlet-stok',outletStokTotal()+' bungkus');
  const piutangReal=outletPiutangTotal();
  setText('n-piutang',idr(piutangReal,true));setText('n-hsup',idr(ST.hutang_sup,true));
  setText('n-cad',idr(ST.dana_cad,true));setText('n-modal',idr(ST.modal,true));
  setText('n-laba',idr(ST.laba_akum,true));setText('n-labau',idr(ST.laba_u,true));
  setText('kb-kas',idr(ST.kas,true));setText('kb-bank',idr(ST.bank,true));
  setText('skm-kas',idr(ST.kas,true));
  setText('kb-hsup',idr(ST.hutang_sup,true));
  // Total utang ringkas
  const totalUtang=(ST.hutang_sup||0)+(ST.utang_upah||0)+(ST.utang_owner||0);
  const ntu=el('n-total-utang');
  if(ntu)ntu.textContent=idr(totalUtang,true);

  const needVisit=OUTLETS.filter(o=>daysSince(o.last_visit)>=7).length;
  function setk(id,ok,yes,no){
    const e=el(id);if(!e)return;
    e.textContent=ok?yes:no;e.className='badge '+(ok?'badge-green':'badge-red');
  }
  setk('k1',ST.stok_kal>=0&&ST.gudang>=0,'Aman','Stok aman');
  setk('k2',outletPiutangTotal()<2000000,'Aman','Bon numpuk');
  setk('k3',needVisit===0,'Kedai oke',needVisit+' kedai');
  setk('k4',ST.laba_u>=0,'Untung','Rugi');
  if(ST.setup){const ss=el('setup-section');if(ss)ss.style.display='none';}
  // Utang upah
  const utangUpah=ST.utang_upah||0;
  const nuu=el('n-utang-upah');
  if(nuu)nuu.textContent=idr(utangUpah,true);
  const rowuu=el('row-utang-upah');
  if(rowuu)rowuu.style.display=utangUpah>0?'flex':'none';
  // Utang owner
  const utangOwner=ST.utang_owner||0;
  const nuo=el('n-utang-owner');
  if(nuo)nuo.textContent=idr(utangOwner,true);
  const rowuo=el('row-utang-owner');
  if(rowuo)rowuo.style.display=utangOwner>0?'flex':'none';
  // Show/hide ambil piutang section
  const secpo=el('sec-piutang-owner');
  const cardpo=el('card-piutang-owner');
  const kbuo=el('kb-utang-owner');
  if(secpo)secpo.style.display=utangOwner>0?'block':'none';
  if(cardpo)cardpo.style.display=utangOwner>0?'block':'none';
  if(kbuo)kbuo.textContent=idr(utangOwner,true);
}

function updateClosingSum(){
  setText('cl-omzet-week',idr(ST.week_omzet));setText('cl-laba-week',idr(ST.week_laba));
  setText('cl-labau',idr(ST.laba_u));setText('cl-kasbon',idr(kasbonAktif()));
  // Sembunyikan form bagi hasil kalau laba_u = 0
  const bhSection=el('bh-section');
  if(bhSection){
    bhSection.style.display=ST.laba_u>0?'block':'none';
  }
}

// ─── SETUP SALDO AWAL ─────────────────────────────────────
async function simpanSetup(){
  const patch={
    kas:+v('s-kas')||0,bank:+v('s-bank')||0,stok_kal:+v('s-kal')||0,
    gudang:+v('s-gudang')||0,piutang:+v('s-piutang')||0,
    hutang_sup:+v('s-hsup')||4320000,dana_cad:+v('s-cad')||0,setup:true
  };
  await saveState(patch);
  await addJurnal('setup','Saldo awal KBB dikunci');
  toast('✅ Saldo awal tersimpan & dikunci!');renderAll();
}

// ─── PRODUKSI ─────────────────────────────────────────────
function prevProd(){
  const kal=+v('pr-kal'),hkal=+v('pr-hkal')||270000,
    bungkus=+v('pr-bungkus'),upah=+v('pr-upah')||80,plastik=+v('pr-plastik')||45;
  if(!kal||!bungkus){el('prev-prod').classList.remove('show');return;}
  const hppK=Math.round((kal*hkal)/bungkus);
  const totUpah=upah*bungkus;
  const hpp=hppK+upah+plastik,margin=HARGA_JUAL-hpp;
  setText('pp-kacang',idr(hppK));
  setText('pp-upah-tot',idr(totUpah));
  setText('pp-hpp',idr(hpp));
  setText('pp-margin',idr(margin)+' ('+Math.round(margin/HARGA_JUAL*100)+'%)');
  el('prev-prod').classList.add('show');
}

async function simpanProduksi(){
  const kal=+v('pr-kal'),hkal=+v('pr-hkal')||270000,
    bungkus=+v('pr-bungkus'),upah=+v('pr-upah')||80,
    plastik=+v('pr-plastik')||45,tgl=v('pr-tgl');
  if(!kal||!bungkus){toast('Isi kaleng dan hasil bungkus');return;}
  if(ST.stok_kal<kal){toast('Stok kaleng kurang! (ada: '+ST.stok_kal+')');return;}
  const hppKacang=Math.round((kal*hkal)/bungkus);
  const hppEstimasi=hppKacang+upah+plastik;
  const totUpah=upah*bungkus;
  try{
    // Catat utang upah ke neraca
    const row={kal,hkal,bungkus,upah,plastik,hpp:hppEstimasi,tot_kas:0,tgl,upah_lunas:false,oleh:USER?USER.nama:'-'};
    const res=await sb('POST','produksi',row);
    if(res&&res.length)PRODUKSI.unshift(res[0]);else PRODUKSI.unshift(row);
    // Update stok kaleng & gudang, tambah utang upah
    await saveState({
      stok_kal:ST.stok_kal-kal,
      gudang:ST.gudang+bungkus,
      utang_upah:(ST.utang_upah||0)+totUpah
    });
    await addJurnal('produksi',`Produksi ${bungkus} bungkus dari ${kal} kaleng | HPP estimasi ${idr(hppEstimasi)}/bungkus | Upah belum dibayar ${idr(totUpah)}`,tgl);
    setv('pr-kal','');setv('pr-bungkus','');
    el('prev-prod').classList.remove('show');
    toast('✅ Produksi dicatat! '+bungkus+' bungkus masuk gudang. Upah: '+idr(totUpah)+' (belum dibayar)');
    renderAll();
  }catch(err){
    toast('❌ Gagal simpan produksi: '+(err.message||err));
    console.error('simpanProduksi:',err);
  }
}

async function koreksiGudang(){
  const fisikStr=v('kg-fisik');
  if(fisikStr===''){toast('Isi stok gudang fisik dulu');return;}
  const fisik=parseInt(fisikStr);
  if(isNaN(fisik)||fisik<0){toast('Angka tidak valid');return;}
  const selisih=fisik-ST.gudang;
  if(selisih===0){toast('Stok app sudah sama dengan fisik');return;}
  if(!confirm(`Koreksi stok gudang:\n${ST.gudang} (app) → ${fisik} (fisik)\nSelisih: ${selisih>0?'+':''}${selisih} bungkus\n\nLanjut?`))return;
  await saveState({gudang:fisik});
  await addJurnal('produksi',`Koreksi gudang (stok opname): ${ST.gudang} → ${fisik} bungkus (selisih ${selisih>0?'+':''}${selisih})`,today());
  setv('kg-fisik','');
  toast('✅ Stok gudang dikoreksi jadi '+fisik+' bungkus');
  renderAll();
}

async function hapusProduksi(id,kal,bungkus,upah,upahLunas){
  if(!confirm('Hapus data produksi ini?'))return;
  const p=PRODUKSI.find(p=>p.id===id);
  await sb('DELETE','produksi',null,'?id=eq.'+id);
  PRODUKSI=PRODUKSI.filter(p=>p.id!==id);
  const totUpah=(upah||0)*bungkus;
  const patch={stok_kal:ST.stok_kal+kal,gudang:Math.max(0,ST.gudang-bungkus)};
  // Kalau upah belum dibayar, kurangi utang upah
  if(!upahLunas)patch.utang_upah=Math.max(0,(ST.utang_upah||0)-totUpah);
  await saveState(patch);
  toast('✅ Data produksi dihapus');renderAll();
}

async function bayarUpah(id,bungkus,upahPerBungkus){
  const totUpah=upahPerBungkus*bungkus;
  if(!confirm('Bayar upah packing '+idr(totUpah)+'?\nKas akan berkurang '+idr(totUpah)))return;
  const patch={};
  if(ST.kas>=totUpah){
    patch.kas=ST.kas-totUpah;
    patch.utang_upah=Math.max(0,(ST.utang_upah||0)-totUpah);
  } else {
    const kurang=totUpah-ST.kas;
    const tambal=confirm(
      'Kas tidak cukup!\nKas: '+idr(ST.kas)+'\nKurang: '+idr(kurang)+
      '\n\nTambal dari uang pribadi lo?\n(KBB catat utang ke owner: '+idr(kurang)+')'
    );
    if(!tambal)return;
    patch.kas=0;
    patch.utang_owner=(ST.utang_owner||0)+kurang;
    patch.utang_upah=Math.max(0,(ST.utang_upah||0)-totUpah);
  }
  await sb('PATCH','produksi',{upah_lunas:true},'?id=eq.'+id);
  const p=PRODUKSI.find(p=>p.id===id);if(p)p.upah_lunas=true;
  const upahDariKas=Math.min(ST.kas,totUpah);
  await saveState(patch);
  await addJurnal('kas',`Bayar upah packing ${bungkus} bungkus: ${idr(totUpah)}`,null,upahDariKas>0?{akun:'kas',keluar:upahDariKas}:null);
  toast('✅ Upah dibayar: '+idr(totUpah));renderAll();
}

function renderListProd(){
  const e=el('list-prod');
  if(!PRODUKSI.length){e.innerHTML='<div class="empty">Belum ada produksi</div>';return;}
  e.innerHTML=PRODUKSI.slice(0,10).map(p=>{
    const totUpah=(p.upah||0)*p.bungkus;
    return`<div class="card" style="margin-bottom:8px">
      <div class="row"><span class="row-label">Tanggal</span><span>${p.tgl}</span></div>
      <div class="row"><span class="row-label">Input → Output</span><span>${p.kal} kaleng → ${p.bungkus} bungkus</span></div>
      <div class="row"><span class="row-label">Modal/bungkus</span><span class="tr">${idr(p.hpp)}</span></div>
      <div class="row"><span class="row-label">Untung/bungkus</span><span class="tg">${idr(HARGA_JUAL-p.hpp)}</span></div>
      <div class="row"><span class="row-label">Upah packing</span>
        <span class="${p.upah_lunas?'tg':'tr'}">${idr(totUpah)} — ${p.upah_lunas?'✅ Udah dibayar':'⏳ Belum dibayar'}</span>
      </div>
      ${!p.upah_lunas?`<button class="btn btn-primary btn-sm" style="margin-top:6px;margin-right:6px" onclick="bayarUpah('${p.id}',${p.bungkus},${p.upah||0})">💰 Bayar Upah</button>`:''}
      <button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="hapusProduksi('${p.id}',${p.kal},${p.bungkus},${p.upah||0},${p.upah_lunas?'true':'false'})">🗑 Hapus</button>
    </div>`;
  }).join('');
}

// ─── OUTLET ───────────────────────────────────────────────
async function simpanOutlet(){
  const nama=v('no-nama').trim(),alamat=v('no-alamat').trim(),tgl=v('no-tgl');
  const rute=+v('no-rute')||0,stok=+v('no-stok')||0;
  if(!nama){toast('Isi nama warung');return;}
  if(!rute){toast('Pilih rute dulu (1-4)');return;}
  const row={nama,alamat,stok,rute,last_visit:null,total_laku:0,total_omzet:0,piutang:0,tgl_mulai:tgl};
  const res=await sb('POST','outlets',row);
  if(res&&res.length)OUTLETS.push(res[0]);else OUTLETS.push(row);
  // Kalau ada stok awal, kurangi dari gudang (kacang pindah dari gudang ke kedai)
  if(stok>0){
    if(stok>ST.gudang){toast('⚠️ Stok awal melebihi gudang ('+ST.gudang+'). Kedai tetap dibuat, cek gudang.');}
    else{await saveState({gudang:ST.gudang-stok});}
  }
  setv('no-nama','');setv('no-alamat','');setv('no-stok','');setv('no-rute','');
  closeModal('modal-outlet');
  await addJurnal('outlet',`Kedai baru: ${nama} (Rute ${rute}, stok ${stok})`,tgl);
  toast('✅ Kedai '+nama+' ditambahkan');renderAll();
}

async function hapusOutlet(id,nama){
  if(!confirm('Hapus kedai '+nama+'?'))return;
  await sb('DELETE','outlets',null,'?id=eq.'+id);
  OUTLETS=OUTLETS.filter(o=>o.id!==id);
  toast('✅ Kedai dihapus');renderAll();
}

async function tambahStokKedai(id,nama,stokSekarang){
  const tambahStr=prompt(`➕ TAMBAH STOK "${nama}" (sekarang: ${stokSekarang} bungkus)\n\nBerapa bungkus dinitip dari gudang?\n(Stok gudang Ilham: ${ST.gudang} bungkus)`);
  if(tambahStr===null)return;
  const tambah=parseInt(tambahStr);
  if(isNaN(tambah)||tambah<=0){alert('Masukkan angka lebih dari 0');return;}
  if(tambah>ST.gudang){alert('Stok gudang tidak cukup! Ada: '+ST.gudang+' bungkus');return;}
  const stokBaru=stokSekarang+tambah;
  await sb('PATCH','outlets',{stok:stokBaru},`?id=eq.${id}`);
  const o=OUTLETS.find(o=>o.id===id);if(o)o.stok=stokBaru;
  // Kacang pindah dari gudang ke kedai
  await saveState({gudang:ST.gudang-tambah});
  await addJurnal('outlet',`Tambah stok ${nama}: +${tambah} bungkus (dari gudang)`,today());
  toast('✅ '+nama+': +'+tambah+' bungkus (gudang -'+tambah+')');
  renderAll();
}

async function koreksiStokKedai(id,nama,stokLama){
  const stokBaru=prompt(`✏️ KOREKSI STOK "${nama}" (sekarang: ${stokLama} bungkus)\n\n⚠️ Ini cuma betulin angka kalau salah catat.\nTIDAK mengubah stok gudang.\nMasukkan stok yang benar:`);
  if(stokBaru===null)return;
  const stok=parseInt(stokBaru);
  if(isNaN(stok)||stok<0){alert('Angka tidak valid');return;}
  const selisih=stok-stokLama;
  if(selisih!==0){
    if(!confirm(`Koreksi stok ${nama}: ${stokLama} → ${stok} (${selisih>0?'+':''}${selisih})\n\n⚠️ Gudang TIDAK berubah. Lanjut?`))return;
  }
  await sb('PATCH','outlets',{stok},`?id=eq.${id}`);
  const o=OUTLETS.find(o=>o.id===id);if(o)o.stok=stok;
  await addJurnal('outlet',`Koreksi stok ${nama}: ${stokLama} → ${stok} bungkus`,today());
  toast('✅ Stok '+nama+' dikoreksi');renderAll();
}

function renderOutlets(){
  const q=(v('search-outlet')||'').toLowerCase();
  const list=OUTLETS.filter(o=>!q||o.nama.toLowerCase().includes(q)||(o.alamat||'').toLowerCase().includes(q));
  setText('outlet-sum',OUTLETS.length+' kedai aktif');
  const alarm=OUTLETS.filter(o=>daysSince(o.last_visit)>=7).length;
  setText('outlet-alarm-sum',alarm>0?'⚠️ '+alarm+' perlu dikunjungi':'✅ Semua kedai udah dikunjungi');
  const e=el('list-outlet');
  if(!list.length){e.innerHTML='<div class="empty">Belum ada kedai</div>';return;}
  e.innerHTML=list.map(o=>{
    const d=daysSince(o.last_visit);
    const dotCls=d>=7?'dot-r':d>=5?'dot-a':'dot-g';
    const badgeCls=d>=7?'badge-red':d>=5?'badge-amber':'badge-green';
    const statusTxt=d>=7?'Kunjungi sekarang':d>=5?'Segera':'Udah dikunjungi';
    return`<div class="outlet-card">
      <div class="outlet-head">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span class="dot ${dotCls}" style="margin-top:5px;flex-shrink:0"></span>
          <div><div class="outlet-name">${o.nama}</div><div class="outlet-addr">${o.alamat||'-'}</div></div>
        </div>
        <span class="badge ${badgeCls}">${statusTxt}</span>
      </div>
      <div class="row"><span class="row-label">Stok di kedai</span><span class="tb">${o.stok} bungkus</span></div>
      <div class="row"><span class="row-label">Kunjungan terakhir</span><span>${o.last_visit||'Belum'} ${d<999?'('+d+' hari)':''}</span></div>
      <div class="row"><span class="row-label">Total terjual</span><span class="tg">${o.total_laku} bungkus</span></div>
      <div class="row"><span class="row-label">Total pemasukan</span><span class="tg">${idr(o.total_omzet,true)}</span></div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-sm" onclick="tambahStokKedai('${o.id}','${o.nama}',${o.stok})" style="flex:1;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe">➕ Tambah Stok</button>
        <button class="btn btn-sm" onclick="koreksiStokKedai('${o.id}','${o.nama}',${o.stok})" style="flex:1">✏️ Koreksi</button>
        <button class="btn btn-danger btn-sm" onclick="hapusOutlet('${o.id}','${o.nama}')" style="flex:0 0 auto">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ─── VISIT ────────────────────────────────────────────────
// ─── VISIT TABS ───────────────────────────────────────────
function switchVisitTab(tab){
  el('tab-catat').style.display = tab==='catat'?'block':'none';
  el('tab-riwayat').style.display = tab==='riwayat'?'block':'none';
  el('tab-catat-btn').style.borderBottomColor = tab==='catat'?'var(--text)':'transparent';
  el('tab-catat-btn').style.color = tab==='catat'?'var(--text)':'var(--text3)';
  el('tab-catat-btn').style.fontWeight = tab==='catat'?'600':'500';
  el('tab-riwayat-btn').style.borderBottomColor = tab==='riwayat'?'var(--text)':'transparent';
  el('tab-riwayat-btn').style.color = tab==='riwayat'?'var(--text)':'var(--text3)';
  el('tab-riwayat-btn').style.fontWeight = tab==='riwayat'?'600':'500';
  if(tab==='riwayat'){_visitLimit=30;renderListVisit();}
}


let _showAllAlarm=false;
function showAllAlarm(){_showAllAlarm=true;renderAlarm();}

function renderAlarm(){
  const urgent=OUTLETS.filter(o=>daysSince(o.last_visit)>=7).sort((a,b)=>daysSince(b.last_visit)-daysSince(a.last_visit));
  const e=el('alarm-list');
  const moreBtn=el('alarm-more');
  if(!urgent.length){
    e.innerHTML='<div class="alert alert-ok">✅ Semua kedai sudah dikunjungi minggu ini</div>';
    if(moreBtn)moreBtn.style.display='none';
    return;
  }
  const tampil=_showAllAlarm?urgent:urgent.slice(0,10);
  e.innerHTML=tampil.map(o=>{
    const d=daysSince(o.last_visit);
    return`<div class="outlet-card">
      <div class="outlet-head">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span class="dot dot-r" style="margin-top:5px;flex-shrink:0"></span>
          <div><div class="outlet-name">${o.nama}</div><div class="outlet-addr">${o.alamat||'-'}</div></div>
        </div>
        <span class="badge badge-red">${d<999?d+' hari lalu':'Belum pernah'}</span>
      </div>
      <div class="row"><span class="row-label">Stok di kedai</span><span>${o.stok} bungkus</span></div>
    </div>`;
  }).join('');
  if(moreBtn)moreBtn.style.display=(!_showAllAlarm&&urgent.length>10)?'block':'none';
  if(!_showAllAlarm&&urgent.length>10){
    const sisa=urgent.length-10;
    const txt=el('alarm-more')?.querySelector('button');
    if(txt)txt.textContent=`Lihat ${sisa} kedai lainnya`;
  }
}

// ─── MODE RUTE ────────────────────────────────────────────
let RUTE_AKTIF = 0; // 0 = belum pilih rute
let KEDAI_RUTE = []; // list kedai di rute aktif

function renderPilihRute(){
  const counts = [1,2,3,4].map(r=>({
    rute:r,
    total: OUTLETS.filter(o=>Number(o.rute)===r).length,
    belum: OUTLETS.filter(o=>Number(o.rute)===r&&daysSince(o.last_visit)>=7).length
  }));
  const e=el('rute-list');
  if(!e)return;
  const labels={1:'Rute 1',2:'Rute 2',3:'Rute 3',4:'Rute 4'};
  const colors={1:'#FFE8E8',2:'#E8F0FF',3:'#E8FFE8',4:'#FFF5E8'};
  const dots={1:'#FF6B6B',2:'#4B9EFF',3:'#4CAF50',4:'#FF9800'};
  e.innerHTML=counts.map(c=>`
    <div style="
      background:${colors[c.rute]};border-radius:12px;padding:14px 16px;
      margin-bottom:10px;border:2px solid transparent;
      transition:all 0.15s">
      <div onclick="pilihRute(${c.rute})" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer">
        <div>
          <div style="font-weight:700;font-size:15px;color:#1c1c1c">${labels[c.rute]}</div>
          <div style="font-size:12px;color:#666;margin-top:2px">${c.total} kedai</div>
        </div>
        <div style="text-align:right">
          ${c.belum>0
            ?`<span style="background:#FF3B30;color:#fff;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">${c.belum} belum</span>`
            :`<span style="background:#34C759;color:#fff;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">✓ Selesai</span>`
          }
        </div>
      </div>
      ${c.belum<c.total?`<button onclick="event.stopPropagation();putaranBaru(${c.rute})" style="margin-top:10px;width:100%;background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.1);border-radius:8px;padding:7px;font-size:12px;font-weight:600;color:#555;cursor:pointer">🔄 Mulai Putaran Baru (reset jadi belum)</button>`:''}
    </div>`).join('');
}

async function putaranBaru(rute){
  const labels={1:'Rute 1',2:'Rute 2',3:'Rute 3',4:'Rute 4'};
  const kedaiRute=OUTLETS.filter(o=>Number(o.rute)===rute);
  if(!confirm(`Mulai putaran baru ${labels[rute]}?\n\n${kedaiRute.length} kedai akan direset jadi "belum dikunjungi".\nStok & uang TIDAK berubah.`))return;
  // Reset last_visit semua kedai di rute ini
  await sb('PATCH','outlets',{last_visit:null},'?rute=eq.'+rute);
  kedaiRute.forEach(o=>{o.last_visit=null;});
  await addJurnal('outlet',`Mulai putaran baru ${labels[rute]}: ${kedaiRute.length} kedai direset`,today());
  toast(`✅ ${labels[rute]}: putaran baru dimulai`);
  renderModeNgampas();
}

function pilihRute(rute){
  RUTE_AKTIF=rute;
  _ruteSearch='';
  const rs=el('rute-search');if(rs)rs.value='';
  KEDAI_RUTE=OUTLETS.filter(o=>Number(o.rute)===rute).sort((a,b)=>{
    // Belum dikunjungi duluan, lalu urutkan per area
    const aLate=daysSince(a.last_visit)>=7?0:1;
    const bLate=daysSince(b.last_visit)>=7?0:1;
    if(aLate!==bLate)return aLate-bLate;
    return (a.alamat||'').localeCompare(b.alamat||'');
  });
  renderModeNgampas();
}

function backToPilihRute(){
  RUTE_AKTIF=0;
  KEDAI_RUTE=[];
  renderModeNgampas();
}

function renderModeNgampas(){
  const pilih=el('section-pilih-rute');
  const mode=el('section-mode-rute');
  if(RUTE_AKTIF===0){
    if(pilih)pilih.style.display='block';
    if(mode)mode.style.display='none';
    renderPilihRute();
  } else {
    if(pilih)pilih.style.display='none';
    if(mode)mode.style.display='block';
    renderModeRute();
  }
}

function searchRute(){
  _ruteSearch=(el('rute-search')?.value||'').toLowerCase().trim();
  renderModeRute();
}

function renderModeRute(){
  const e=el('list-kedai-rute');
  if(!e)return;
  const labels={1:'Rute 1',2:'Rute 2',3:'Rute 3',4:'Rute 4'};
  setText('rute-aktif-label',labels[RUTE_AKTIF]);

  // Selalu ambil data terbaru dari OUTLETS (biar last_visit & piutang update real-time)
  KEDAI_RUTE=OUTLETS.filter(o=>Number(o.rute)===RUTE_AKTIF).sort((a,b)=>{
    const aLate=daysSince(a.last_visit)>=7?0:1;
    const bLate=daysSince(b.last_visit)>=7?0:1;
    if(aLate!==bLate)return aLate-bLate;
    return (a.alamat||'').localeCompare(b.alamat||'');
  });

  // Filter berdasarkan search
  const list=_ruteSearch
    ?KEDAI_RUTE.filter(o=>o.nama.toLowerCase().includes(_ruteSearch)||(o.alamat||'').toLowerCase().includes(_ruteSearch))
    :KEDAI_RUTE;

  // Progress dari SEMUA kedai rute (bukan filtered)
  const sudah=KEDAI_RUTE.filter(o=>daysSince(o.last_visit)<7).length;
  const pct=KEDAI_RUTE.length?Math.round(sudah/KEDAI_RUTE.length*100):0;
  setText('rute-progress',`${sudah}/${KEDAI_RUTE.length} dikunjungi`);
  const pb=el('rute-progress-bar');
  if(pb)pb.style.width=pct+'%';

  // Summary tunai hari ini dari VISITS rute ini
  const visitHariIni=VISITS.filter(v=>{
    const o=OUTLETS.find(o=>o.id===v.outlet_id);
    return o&&Number(o.rute)===RUTE_AKTIF&&v.tgl===today();
  });
  const totalTunai=visitHariIni.reduce((s,v)=>s+(v.bayar_tunai||0),0);
  const totalBon=visitHariIni.reduce((s,v)=>s+(v.bayar_bon||0),0);
  const totalLaku=visitHariIni.reduce((s,v)=>s+(v.laku||0),0);
  const summEl=el('rute-summary');
  if(summEl){
    if(visitHariIni.length>0){
      summEl.style.display='block';
      summEl.innerHTML=`
        <div style="display:flex;gap:12px;font-size:12px">
          <div><div style="color:var(--text3)">Laku</div><div style="font-weight:700">${totalLaku} bungkus</div></div>
          <div><div style="color:var(--text3)">Tunai masuk</div><div style="font-weight:700;color:#34C759">${idr(totalTunai)}</div></div>
          ${totalBon>0?`<div><div style="color:var(--text3)">Bon baru</div><div style="font-weight:700;color:#FF3B30">${idr(totalBon)}</div></div>`:''}
        </div>`;
    } else {
      summEl.style.display='none';
    }
  }

  // Kelompok per area
  const areaMap={};
  for(const o of list){
    const a=o.alamat||'-';
    if(!areaMap[a])areaMap[a]=[];
    areaMap[a].push(o);
  }

  if(!list.length){
    e.innerHTML=`<div class="empty">${_ruteSearch?'Tidak ada kedai yang cocok':'Belum ada kedai di rute ini'}</div>`;
    return;
  }

  e.innerHTML=Object.entries(areaMap).sort().map(([area,kedais])=>`
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:0.5px;
        padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:6px">
        📍 ${area}
      </div>
      ${kedais.map(o=>{
        const sudahVisit=daysSince(o.last_visit)<7;
        const hasBon=(o.piutang||0)>0;
        return`<div onclick="bukaModalVisit('${o.id}')" style="
          display:flex;justify-content:space-between;align-items:center;
          padding:10px 12px;border-radius:10px;margin-bottom:6px;cursor:pointer;
          background:${sudahVisit?'var(--bg)':'#fff'};
          border:1.5px solid ${sudahVisit?'var(--border)':'#E0E0E0'};
          opacity:${sudahVisit?'0.6':'1'}">
          <div>
            <div style="font-weight:600;font-size:13px;color:${sudahVisit?'var(--text3)':'var(--text)'}">${o.nama}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:1px">
              Stok: ${o.stok} bungkus
              ${hasBon?`<span style="color:#FF3B30;font-weight:600"> · ⚠️ Bon ${idr(o.piutang)}</span>`:''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${sudahVisit
              ?'<span style="color:#34C759;font-size:18px">✓</span>'
              :'<span style="color:#ccc;font-size:16px">›</span>'
            }
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

// ─── MODAL VISIT ──────────────────────────────────────────
let VISIT_OUTLET_ID = null;
let _tunaiEdited = false;

function tunaiManualEdit(){
  _tunaiEdited=true;
  calcModalVisit();
}

function bukaModalVisit(outletId){
  VISIT_OUTLET_ID=outletId;
  _tunaiEdited=false;
  const o=OUTLETS.find(o=>o.id===outletId);
  if(!o)return;
  setText('mv-nama',o.nama);
  setText('mv-area',o.alamat||'-');
  setText('mv-stok',o.stok+' bungkus');
  setText('mv-last',o.last_visit?o.last_visit+' ('+daysSince(o.last_visit)+' hari lalu)':'Belum pernah');
  const bonRow=el('mv-bon-row');
  if(bonRow)bonRow.style.display=(o.piutang||0)>0?'flex':'none';
  setText('mv-bon',idr(o.piutang||0));
  const bayarBonRow=el('mv-bayar-bon-lama-row');
  if(bayarBonRow)bayarBonRow.style.display=(o.piutang||0)>0?'block':'none';
  setv('mv-sisa','');setv('mv-refill','');setv('mv-tunai','');setv('mv-bon-lama','');setv('mv-rusak','0');
  el('mv-preview').style.display='none';
  setv('mv-tgl',today());
  openModal('modal-visit');
}

function calcModalVisit(){
  const o=OUTLETS.find(o=>o.id===VISIT_OUTLET_ID);
  if(!o||v('mv-sisa')===''){el('mv-preview').style.display='none';return;}
  const sisa=+v('mv-sisa'),refill=+v('mv-refill')||0,rusak=+v('mv-rusak')||0;
  const laku=Math.max(0,o.stok-sisa);
  const omzet=laku*HARGA_JUAL,hpp=lastHPP(),laba=laku*(HARGA_JUAL-hpp);
  // Pergerakan stok
  const newStok=refill>0?refill:sisa-rusak;
  const balikGudang=refill>0?Math.max(0,sisa-rusak):0;
  // Auto-fill bayar tunai = omzet kalau user belum edit manual
  if(!_tunaiEdited){
    setv('mv-tunai',omzet>0?omzet:'');
  }
  const tunai=Math.min(+v('mv-tunai')||0,omzet);
  const bon=omzet-tunai;
  setText('mv-laku',laku+' bungkus');
  setText('mv-omzet',idr(omzet));
  setText('mv-tunai-preview',idr(tunai));
  setText('mv-bon-preview',bon>0?idr(bon):'Rp0');
  // Info stok kedai jadi & balik gudang
  setText('mv-stok-baru',newStok+' bungkus');
  const balikEl=el('mv-balik-row');
  if(balikEl)balikEl.style.display=balikGudang>0?'flex':'none';
  setText('mv-balik',balikGudang+' bungkus');
  // Indikator lunas/bon
  const statusEl=el('mv-status');
  if(statusEl){
    if(omzet===0){
      statusEl.style.display='none';
    } else if(bon===0){
      statusEl.style.display='block';
      statusEl.innerHTML='<div style="background:#dcfce7;color:#16a34a;border-radius:8px;padding:8px 12px;font-weight:700;text-align:center;font-size:13px">✓ LUNAS</div>';
    } else {
      statusEl.style.display='block';
      statusEl.innerHTML=`<div style="background:#fee2e2;color:#dc2626;border-radius:8px;padding:8px 12px;font-weight:700;text-align:center;font-size:13px">⚠️ NGEBON ${idr(bon)}</div>`;
    }
  }
  el('mv-preview').style.display='block';
}

let _savingVisit=false;
async function simpanModalVisit(){
  if(_savingVisit)return;
  const o=OUTLETS.find(o=>o.id===VISIT_OUTLET_ID);
  if(!o){toast('Outlet tidak ditemukan');return;}
  if(v('mv-sisa')===''){toast('Isi sisa bungkus dulu');return;}
  _savingVisit=true;
  const btnSimpan=el('mv-btn-simpan');
  if(btnSimpan){btnSimpan.disabled=true;btnSimpan.textContent='⏳ Menyimpan...';}
  const sisa=+v('mv-sisa'),refill=+v('mv-refill')||0,rusak=+v('mv-rusak')||0;
  const laku=Math.max(0,o.stok-sisa);
  const omzet=laku*HARGA_JUAL,hpp=lastHPP();
  const bayarTunai=Math.min(+v('mv-tunai')||0,omzet);
  const bayarBon=omzet-bayarTunai;
  const bayarBonLama=Math.min(+v('mv-bon-lama')||0,o.piutang||0);
  const tgl=v('mv-tgl')||today();
  function batalSimpan(msg){
    toast(msg);
    _savingVisit=false;
    if(btnSimpan){btnSimpan.disabled=false;btnSimpan.textContent='✅ Simpan';}
  }
  if(sisa>o.stok){batalSimpan('Sisa tidak boleh lebih dari stok kedai ('+o.stok+')');return;}
  if(rusak>sisa){batalSimpan('Rusak tidak boleh lebih dari sisa ('+sisa+')');return;}
  if(refill>ST.gudang){batalSimpan('Stok gudang tidak cukup! (ada: '+ST.gudang+' bungkus)');return;}
  const newStok=refill>0?refill:sisa-rusak;
  const newPiutang=Math.max(0,(o.piutang||0)-bayarBonLama)+bayarBon;
  // Laba bersih = untung jualan - kerugian barang rusak (modal hangus)
  const labaBersih=laku*(HARGA_JUAL-hpp)-rusak*hpp;

  try {
    // 1. Simpan visit DULU (kalau gagal, hentikan sebelum ubah apapun)
    const visitRow={outlet_id:o.id,outlet_nama:o.nama,stok_awal:o.stok,
      sisa,laku,refill,rusak,omzet,laba:labaBersih,hpp,
      bayar_tunai:bayarTunai,bayar_bon:bayarBon,bayar_bon_lama:bayarBonLama,tgl,oleh:USER?USER.nama:'-'};
    const res=await sb('POST','visits',visitRow);

    // 2. Update outlet
    await sb('PATCH','outlets',{
      stok:newStok,last_visit:tgl,
      total_laku:(o.total_laku||0)+laku,
      total_omzet:(o.total_omzet||0)+omzet,
      piutang:newPiutang
    },'?id=eq.'+o.id);
    const oIdx=OUTLETS.findIndex(x=>x.id===o.id);
    if(oIdx>=0)OUTLETS[oIdx]={...o,stok:newStok,last_visit:tgl,
      total_laku:(o.total_laku||0)+laku,
      total_omzet:(o.total_omzet||0)+omzet,
      piutang:newPiutang};
    if(res&&res.length)VISITS.unshift(res[0]);else VISITS.unshift(visitRow);

    // 3. Update state global (kas, piutang, gudang, laba)
    const totalKasMasuk=bayarTunai+bayarBonLama;
    const stPatch={
      gudang:ST.gudang-refill+(refill>0?sisa-rusak:0),
      total_omzet:ST.total_omzet+omzet,total_hpp:ST.total_hpp+(laku+rusak)*hpp,
      laba_akum:ST.laba_akum+labaBersih,laba_u:ST.laba_u+labaBersih,
      week_omzet:ST.week_omzet+omzet,week_laba:ST.week_laba+labaBersih,
      kas:ST.kas+totalKasMasuk,
      piutang:outletPiutangTotal()
    };
    await saveState(stPatch);
    await addJurnal('visit',`Kunjungan ${o.nama}: ${laku} terjual | tunai ${idr(totalKasMasuk,true)} | bon ${idr(bayarBon,true)} | refill ${refill}`,tgl,totalKasMasuk>0?{akun:'kas',masuk:totalKasMasuk}:null);
    closeModal('modal-visit');
    toast(`✅ ${o.nama}: ${laku} laku`);
    renderModeRute();
    renderNeraca();
  } catch(err) {
    toast('❌ Gagal simpan: '+(err.message||err));
    console.error('simpanModalVisit error:',err);
  } finally {
    _savingVisit=false;
    const btn=el('mv-btn-simpan');
    if(btn){btn.disabled=false;btn.textContent='✅ Simpan';}
  }
}

async function cekDoangModal(){
  const o=OUTLETS.find(o=>o.id===VISIT_OUTLET_ID);
  if(!o)return;
  const tgl=v('mv-tgl')||today();
  await sb('PATCH','outlets',{last_visit:tgl},'?id=eq.'+o.id);
  const oIdx=OUTLETS.findIndex(x=>x.id===o.id);
  if(oIdx>=0)OUTLETS[oIdx]={...o,last_visit:tgl};
  const visitRow={outlet_id:o.id,outlet_nama:o.nama,stok_awal:o.stok,
    sisa:o.stok,laku:0,refill:0,rusak:0,omzet:0,laba:0,hpp:0,
    bayar_tunai:0,bayar_bon:0,tgl,oleh:USER?USER.nama:'-'};
  const resC=await sb('POST','visits',visitRow);
  if(resC&&resC.length)VISITS.unshift(resC[0]);else VISITS.unshift(visitRow);
  await addJurnal('visit',`Kunjungan cek: ${o.nama}`,tgl);
  closeModal('modal-visit');
  toast(`📍 ${o.nama} ditandai dikunjungi`);
  renderModeRute();
  renderPilihRute();
}

function renderVisitSelect(){
  // Legacy - tidak dipakai di mode rute, tapi dipertahankan untuk kompatibilitas
}





async function hapusVisit(id,laku,omzet,laba,hpp,bayarTunai,bayarBon,refill,sisa,rusak,outletId,stokLama){
  if(!confirm('Hapus data visit ini? Stok & keuangan akan dibalikkan.'))return;
  // Ambil data visit lengkap (termasuk bayar_bon_lama) sebelum dihapus
  const visitIni=VISITS.find(v=>v.id===id);
  const bayarBonLama=visitIni?(visitIni.bayar_bon_lama||0):0;
  // Cari visit sebelumnya untuk restore last_visit
  const visitSebelum=VISITS.filter(v=>v.outlet_id===outletId&&v.id!==id).sort((a,b)=>new Date(b.tgl)-new Date(a.tgl));
  const lastVisitSebelum=visitSebelum.length?visitSebelum[0].tgl:null;
  await sb('DELETE','visits',null,'?id=eq.'+id);
  VISITS=VISITS.filter(v=>v.id!==id);
  const o=OUTLETS.find(o=>o.id===outletId);
  if(o){
    // Balik piutang: kurangi bon baru yang ditambahkan, tambah lagi bon lama yang sempat dibayar
    const newPiutang=Math.max(0,(o.piutang||0)-bayarBon+bayarBonLama);
    await sb('PATCH','outlets',{
      stok:stokLama,
      piutang:newPiutang,
      last_visit:lastVisitSebelum,
      total_laku:Math.max(0,(o.total_laku||0)-laku),
      total_omzet:Math.max(0,(o.total_omzet||0)-omzet)
    },'?id=eq.'+outletId);
    o.stok=stokLama;o.piutang=newPiutang;o.last_visit=lastVisitSebelum;
    o.total_laku=Math.max(0,(o.total_laku||0)-laku);
    o.total_omzet=Math.max(0,(o.total_omzet||0)-omzet);
  }
  const balikGudang=refill>0?sisa-rusak:0;
  // Sebagian tunai mungkin sudah dipindah ke Mandiri (tf_mandiri)
  const tfMandiri=visitIni?(visitIni.tf_mandiri||0):0;
  // Total uang masuk = bayar tunai + bayar bon lama. Sebagian (tfMandiri) ada di bank.
  const totalMasuk=bayarTunai+bayarBonLama;
  const dariBank=Math.min(tfMandiri,ST.bank);          // tarik balik dari Mandiri dulu
  const dariKas=Math.max(0,totalMasuk-dariBank);        // sisanya dari kas
  const stPatch={
    gudang:ST.gudang+refill-balikGudang,
    kas:Math.max(0,ST.kas-dariKas),
    bank:Math.max(0,ST.bank-dariBank),
    piutang:outletPiutangTotal(),
    total_omzet:Math.max(0,ST.total_omzet-omzet),
    total_hpp:Math.max(0,ST.total_hpp-(laku+rusak)*hpp),
    laba_akum:Math.max(0,ST.laba_akum-laba),laba_u:Math.max(0,ST.laba_u-laba),
    week_omzet:Math.max(0,ST.week_omzet-omzet),week_laba:Math.max(0,ST.week_laba-laba)
  };
  await saveState(stPatch);
  toast('✅ Kunjungan dihapus & data dibalikkan');renderAll();
}

function renderListVisit(){
  const rvArea=el('rv-area');
  const rvOutlet=el('rv-outlet');
  const rvSearch=(v('rv-search')||'').toLowerCase();
  if(rvArea&&rvArea.options.length<=1){
    const areas=[...new Set(OUTLETS.map(o=>o.alamat||'').filter(a=>a))].sort();
    rvArea.innerHTML='<option value="">Semua area</option>'+
      areas.map(a=>`<option value="${a}">${a}</option>`).join('');
  }
  if(rvOutlet&&rvOutlet.options.length<=1){
    rvOutlet.innerHTML='<option value="">Semua kedai</option>'+
      OUTLETS.map(o=>`<option value="${o.id}">${o.nama}</option>`).join('');
  }
  const filterArea=v('rv-area')||'';
  const filterOutlet=v('rv-outlet')||'';
  const filterRute=v('rv-rute')||'';
  const filterTgl=v('rv-tgl')||'';
  let filteredVisits=VISITS;
  if(filterRute) filteredVisits=filteredVisits.filter(vi=>{
    const o=OUTLETS.find(o=>o.id===vi.outlet_id);
    return o&&Number(o.rute)===Number(filterRute);
  });
  if(filterTgl) filteredVisits=filteredVisits.filter(vi=>vi.tgl===filterTgl);
  if(filterArea) filteredVisits=filteredVisits.filter(vi=>{
    const o=OUTLETS.find(o=>o.id===vi.outlet_id);
    return o&&o.alamat===filterArea;
  });
  if(filterOutlet) filteredVisits=filteredVisits.filter(vi=>vi.outlet_id===filterOutlet);
  if(rvSearch) filteredVisits=filteredVisits.filter(vi=>(vi.outlet_nama||'').toLowerCase().includes(rvSearch));
  const e=el('list-visit');
  if(!filteredVisits.length){e.innerHTML='<div class="empty">Belum ada kunjungan</div>';return;}
  // Ringkasan total dari hasil filter
  const sumLaku=filteredVisits.reduce((s,vi)=>s+(vi.laku||0),0);
  const sumOmzet=filteredVisits.reduce((s,vi)=>s+(vi.omzet||0),0);
  const sumTunai=filteredVisits.reduce((s,vi)=>s+(vi.bayar_tunai||0),0);
  const sumBon=filteredVisits.reduce((s,vi)=>s+(vi.bayar_bon||0),0);
  const sumBonLama=filteredVisits.reduce((s,vi)=>s+(vi.bayar_bon_lama||0),0);
  const ringkasan=`<div class="card" style="margin-bottom:10px;background:var(--blue-bg);border:1px solid #bfdbfe">
    <div style="font-weight:700;font-size:13px;margin-bottom:6px">📊 Ringkasan (${filteredVisits.length} kunjungan)</div>
    <div class="row"><span class="row-label">Total laku</span><span class="tb">${sumLaku} bungkus</span></div>
    <div class="row"><span class="row-label">Total omzet</span><span class="tb tg">${idr(sumOmzet)}</span></div>
    <div class="row"><span class="row-label">Bayar tunai</span><span class="tg">${idr(sumTunai)}</span></div>
    ${sumBon>0?`<div class="row"><span class="row-label">Bon baru</span><span class="tr">${idr(sumBon)}</span></div>`:''}
    ${sumBonLama>0?`<div class="row"><span class="row-label">Bayar bon lama</span><span class="tg">${idr(sumBonLama)}</span></div>`:''}
    <div class="row" style="border-top:1px solid #bfdbfe;margin-top:4px;padding-top:4px"><span class="row-label tb">Kas masuk</span><span class="tb tg">${idr(sumTunai+sumBonLama)}</span></div>
  </div>`;
  const tampil=filteredVisits.slice(0,_visitLimit);
  e.innerHTML=ringkasan+tampil.map(v=>`
    <div class="card" style="margin-bottom:8px">
      <div class="row"><span class="row-label tb">${v.outlet_nama}</span><span style="color:var(--text3)">${v.tgl}${v.oleh&&v.oleh!=='-'?' · '+v.oleh:''}</span></div>
      <div class="row"><span class="row-label">Laku</span><span class="tg tb">${v.laku} bungkus</span></div>
      <div class="row"><span class="row-label">Omzet</span><span class="tg">${idr(v.omzet)}</span></div>
      <div class="row"><span class="row-label">Sisa balik gudang</span><span>${v.sisa} bungkus</span></div>
      <div class="row"><span class="row-label">Isi ulang</span><span>${v.refill} bungkus</span></div>
      ${v.rusak?`<div class="row"><span class="row-label">Rusak</span><span class="tr">${v.rusak} bungkus</span></div>`:''}
      ${v.laku===0&&v.omzet===0?'<div style="margin:4px 0"><span class="badge" style="background:var(--blue-bg);color:var(--blue);padding:2px 8px;border-radius:8px;font-size:11px">👁 Kunjungan Cek</span></div>':''}
      ${v.bayar_tunai>0?`<div class="row"><span class="row-label">Bayar Tunai</span><span class="tg">${idr(v.bayar_tunai)}</span></div>`:''}
      ${v.bayar_bon>0?`<div class="row"><span class="row-label">Bon</span><span class="tr">${idr(v.bayar_bon)}</span></div>`:''}
      ${(v.tf_mandiri||0)>0?`<div class="row"><span class="row-label">🏦 Sudah TF Mandiri</span><span class="tb" style="color:#2563eb">${idr(v.tf_mandiri)}</span></div>
      <button class="btn btn-sm" style="margin-top:6px;background:#fef3c7;color:#92400e;border:1px solid #fde68a" onclick="batalkanTF('${v.id}')">↩️ Batalkan TF (balik ke kas)</button>`:''}
      ${v.bayar_tunai>0&&(v.tf_mandiri||0)<v.bayar_tunai?`<button class="btn btn-sm" style="margin-top:6px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe" onclick="bukaKonversiTF('${v.id}')">🏦 Konversi ke TF Mandiri</button>`:''}
      <button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="hapusVisit('${v.id}',${v.laku},${v.omzet},${v.laba},${v.hpp},${v.bayar_tunai||0},${v.bayar_bon||0},${v.refill},${v.sisa},${v.rusak||0},'${v.outlet_id}',${v.stok_awal})">🗑 Hapus Visit</button>
    </div>`).join('')
    +(filteredVisits.length>_visitLimit?`<button class="btn" style="width:100%;margin-top:4px" onclick="tampilLebihVisit()">⬇️ Tampilkan lebih banyak (${filteredVisits.length-_visitLimit} lagi)</button>`:'');
}

function tampilLebihVisit(){_visitLimit+=30;renderListVisit();}

// ─── KONVERSI TUNAI → TF MANDIRI ──────────────────────────
let _konversiVisitId=null;

function bukaKonversiTF(visitId){
  const v=VISITS.find(x=>x.id===visitId);
  if(!v)return;
  _konversiVisitId=visitId;
  const sudahTF=v.tf_mandiri||0;
  const sisaBisaTF=(v.bayar_tunai||0)-sudahTF;
  setText('ktf-nama',v.outlet_nama);
  setText('ktf-tunai',idr(v.bayar_tunai||0));
  setText('ktf-sisa',idr(sisaBisaTF));
  setv('ktf-nom',sisaBisaTF>0?sisaBisaTF:'');
  openModal('modal-konversi-tf');
}

async function konfirmasiKonversiTF(){
  const vis=VISITS.find(x=>x.id===_konversiVisitId);
  if(!vis){toast('Visit tidak ditemukan');return;}
  const nom=+v('ktf-nom');
  const sudahTF=vis.tf_mandiri||0;
  const sisaBisaTF=(vis.bayar_tunai||0)-sudahTF;
  if(!nom||nom<=0){toast('Isi nominal');return;}
  if(nom>sisaBisaTF){toast('Melebihi sisa tunai yang bisa dipindah: '+idr(sisaBisaTF));return;}
  if(ST.kas<nom){toast('Kas tidak cukup: '+idr(ST.kas));return;}
  // Update visit: tambah tf_mandiri
  const newTF=sudahTF+nom;
  await sb('PATCH','visits',{tf_mandiri:newTF},'?id=eq.'+_konversiVisitId);
  const vIdx=VISITS.findIndex(x=>x.id===_konversiVisitId);
  if(vIdx>=0)VISITS[vIdx]={...vis,tf_mandiri:newTF};
  // Kas berkurang, Mandiri bertambah
  await saveState({kas:ST.kas-nom,bank:ST.bank+nom});
  await addJurnal('kas',`Konversi TF Mandiri ${vis.outlet_nama}: Kas -${idr(nom,true)} → Mandiri +${idr(nom,true)}`,today(),{akun:'kas',keluar:nom});
  await addJurnal('kas',`Terima TF Mandiri ${vis.outlet_nama}: dari kas ${idr(nom,true)}`,today(),{akun:'bank',masuk:nom});
  closeModal('modal-konversi-tf');
  toast('✅ '+idr(nom)+' dipindah ke Mandiri');
  renderListVisit();
  renderNeraca();
}

async function batalkanTF(visitId){
  const vis=VISITS.find(x=>x.id===visitId);
  if(!vis){toast('Visit tidak ditemukan');return;}
  const sudahTF=vis.tf_mandiri||0;
  if(sudahTF<=0){toast('Visit ini tidak ada TF Mandiri');return;}
  if(ST.bank<sudahTF){toast('Saldo Mandiri tidak cukup untuk dibalikin: '+idr(ST.bank));return;}
  if(!confirm(`Batalkan TF Mandiri ${vis.outlet_nama}?\n\n${idr(sudahTF)} akan dikembalikan:\nMandiri -${idr(sudahTF)} → Kas +${idr(sudahTF)}\n\nLanjut?`))return;
  // Reset tf_mandiri visit jadi 0
  await sb('PATCH','visits',{tf_mandiri:0},'?id=eq.'+visitId);
  const vIdx=VISITS.findIndex(x=>x.id===visitId);
  if(vIdx>=0)VISITS[vIdx]={...vis,tf_mandiri:0};
  // Mandiri berkurang, kas balik
  await saveState({bank:ST.bank-sudahTF,kas:ST.kas+sudahTF});
  await addJurnal('kas',`Batal TF Mandiri ${vis.outlet_nama}: Mandiri -${idr(sudahTF,true)} → Kas +${idr(sudahTF,true)}`,today(),{akun:'bank',keluar:sudahTF});
  await addJurnal('kas',`Kas kembali dari batal TF ${vis.outlet_nama}: +${idr(sudahTF,true)}`,today(),{akun:'kas',masuk:sudahTF});
  toast('✅ TF dibatalkan, '+idr(sudahTF)+' kembali ke kas');
  renderListVisit();
  renderNeraca();
}

// ─── CLOSING ──────────────────────────────────────────────
let bhOwnerStatus=null,bhIlhamStatus=null,bhMotorStatus=null;

function setOwnerStatus(s){
  bhOwnerStatus=s;
  el('btn-owner-ambil').className='btn btn-sm'+(s==='ambil'?' btn-active':'');
  el('btn-owner-belum').className='btn btn-sm'+(s==='belum'?' btn-active':'');
}

function setIlhamStatus(s){
  bhIlhamStatus=s;
  ['tunai','kasbon','sebagian'].forEach(x=>{
    const b=el('btn-ilham-'+x);
    if(b)b.className='btn btn-sm'+(s===x?' btn-active':'');
  });
  el('ilham-sebagian-input').style.display=s==='sebagian'?'block':'none';
  hitungIlham();
}

function setMotorStatus(s){
  bhMotorStatus=s;
  el('btn-motor-bayar').className='btn btn-sm'+(s==='bayar'?' btn-active':'');
  el('btn-motor-belum').className='btn btn-sm'+(s==='belum'?' btn-active':'');
}

function hitungIlham(){
  const laba=+v('bh-input');if(!laba)return;
  const lunas=ST.motor_lunas;
  const mitra=Math.floor(laba*(lunas?0.45:0.35));
  const kasbon=kasbonAktif();
  let pot=0,net=0;
  if(bhIlhamStatus==='tunai'){net=mitra;pot=0;}
  else if(bhIlhamStatus==='kasbon'){pot=Math.min(kasbon,mitra);net=mitra-pot;}
  else if(bhIlhamStatus==='sebagian'){
    const tunai=+v('ilham-tunai-nom')||0;
    pot=Math.min(kasbon,Math.max(0,mitra-tunai));
    net=tunai;
  }
  setText('bh-net',idr(net));
  setText('bh-pot',pot>0?'-'+idr(pot):'-');
  setText('bh-sisa-kasbon',idr(Math.max(0,kasbon-pot)));
  if(el('ilham-kasbon-pot'))setText('ilham-kasbon-pot',idr(pot));
}

function hitungSebagian(){hitungIlham();}

function prevBH(){
  const laba=+v('bh-input');
  if(!laba){el('prev-bh').classList.remove('show');return;}
  if(laba>ST.laba_u){toast('Melebihi laba tersedia: '+idr(ST.laba_u));el('prev-bh').classList.remove('show');return;}
  const lunas=ST.motor_lunas;
  const owner=Math.floor(laba*(lunas?0.51:0.55));
  const mitra=Math.floor(laba*(lunas?0.45:0.35));
  const motor=laba-owner-mitra-(lunas?Math.floor(laba*0.04):0);
  const cad=lunas?laba-owner-mitra-motor:0;
  el('bh-bar').innerHTML=lunas
    ?`<div class="feseg" style="width:51%;background:#1c1c1c">Lo 51%</div><div class="feseg" style="width:45%;background:#5f5e5a">Ilham 45%</div><div class="feseg" style="width:4%;background:#888">4%</div>`
    :`<div class="feseg" style="width:55%;background:#1c1c1c">Lo 55%</div><div class="feseg" style="width:35%;background:#5f5e5a">Ilham 35%</div><div class="feseg" style="width:10%;background:#888">Mtr</div>`;
  setText('bh-owner',idr(owner));setText('bh-mitra',idr(mitra));
  setText('bh-cicil',idr(motor));setText('bh-cad',idr(cad));
  if(cad>0)el('row-cad').style.display='flex';else el('row-cad').style.display='none';
  // Reset pilihan
  bhOwnerStatus=null;bhIlhamStatus=null;bhMotorStatus=null;
  ['btn-owner-ambil','btn-owner-belum','btn-ilham-tunai','btn-ilham-kasbon','btn-ilham-sebagian','btn-motor-bayar','btn-motor-belum'].forEach(id=>{
    const b=el(id);if(b)b.className='btn btn-sm';
  });
  el('ilham-sebagian-input').style.display='none';
  setText('bh-net','-');setText('bh-pot','-');
  setText('bh-sisa-kasbon',idr(kasbonAktif()));
  el('prev-bh').classList.add('show');
}

async function simpanClosing(){
  const bhLaba=+v('bh-input')||0;
  if(!bhLaba){toast('Isi nominal laba dulu');return;}
  if(bhLaba>ST.laba_u){toast('Melebihi laba tersedia: '+idr(ST.laba_u));return;}
  if(!bhOwnerStatus){toast('⚠️ Pilih status fee owner dulu!');return;}
  if(!bhIlhamStatus){toast('⚠️ Pilih pembayaran fee Ilham dulu!');return;}
  if(!bhMotorStatus){toast('⚠️ Pilih status cicilan motor dulu!');return;}
  const lunas=ST.motor_lunas;
  const owner=Math.floor(bhLaba*(lunas?0.51:0.55));
  const mitra=Math.floor(bhLaba*(lunas?0.45:0.35));
  const motor=bhLaba-owner-mitra-(lunas?Math.floor(bhLaba*0.04):0);
  const cad=lunas?bhLaba-owner-mitra-motor:0;
  let pot=0,tunaiIlham=0;
  if(bhIlhamStatus==='kasbon'){pot=Math.min(kasbonAktif(),mitra);}
  else if(bhIlhamStatus==='sebagian'){
    tunaiIlham=+v('ilham-tunai-nom')||0;
    pot=Math.min(kasbonAktif(),Math.max(0,mitra-tunaiIlham));
  } else if(bhIlhamStatus==='tunai'){tunaiIlham=mitra;}
  const kasOwner=bhOwnerStatus==='ambil'?owner:0;
  const kasMotor=bhMotorStatus==='bayar'?motor:0;
  const totalKasBerkurang=kasOwner+tunaiIlham+kasMotor;
  // Cascade: kas dulu → kurang? tambal Mandiri → kurang? tambal pribadi (utang owner)
  let sisaBayar=totalKasBerkurang;
  const dariKas=Math.min(ST.kas,sisaBayar);sisaBayar-=dariKas;
  const dariBank=Math.min(ST.bank,sisaBayar);sisaBayar-=dariBank;
  const dariPribadi=sisaBayar;
  let sumberDana='Kas -'+idr(dariKas);
  if(dariBank>0)sumberDana+=' | Mandiri -'+idr(dariBank);
  if(dariPribadi>0)sumberDana+=' | Pribadi -'+idr(dariPribadi)+' (jadi utang KBB ke lo)';
  const ok=confirm(
    'KONFIRMASI CLOSING\n\n'+
    'Bagian Syarvi: '+idr(owner)+' - '+(bhOwnerStatus==='ambil'?'Sudah diambil (kas -'+idr(owner)+')':'Belum diambil')+'\n'+
    'Fee Ilham: '+idr(mitra)+' - '+(bhIlhamStatus==='tunai'?'Bayar tunai':bhIlhamStatus==='kasbon'?'Potong kasbon Ilham -'+idr(pot):'Tunai '+idr(tunaiIlham)+' + Potong kasbon Ilham -'+idr(pot))+'\n'+
    'Cicilan Motor: '+idr(motor)+' - '+(bhMotorStatus==='bayar'?'Udah dibayar':'Belum dibayar')+'\n\n'+
    'Total keluar: '+idr(totalKasBerkurang)+'\n'+
    'Sumber: '+sumberDana+'\n'+
    'Sisa kasbon: '+idr(Math.max(0,kasbonAktif()-pot))+'\n\n'+
    'Lanjut simpan?'
  );
  if(!ok)return;
  const patch={};
  patch.kas=ST.kas-dariKas;
  if(dariBank>0)patch.bank=ST.bank-dariBank;
  if(dariPribadi>0)patch.utang_owner=(ST.utang_owner||0)+dariPribadi;
  if(bhMotorStatus==='bayar'){
    patch.motor_bayar=Math.min(MOTOR_NILAI,ST.motor_bayar+motor);
    patch.motor_lunas=patch.motor_bayar>=MOTOR_NILAI;
  }
  if(pot>0){
    let s=pot;
    for(const k of KASBON){
      if(!k.lunas&&s>0){
        if(s>=k.nom){await sb('PATCH','kasbon',{lunas:true},'?id=eq.'+k.id);k.lunas=true;s-=k.nom;}
        else{await sb('PATCH','kasbon',{nom:k.nom-s},'?id=eq.'+k.id);k.nom=k.nom-s;s=0;}
      }
    }
  }
  patch.dana_cad=ST.dana_cad+cad;
  patch.laba_u=Math.max(0,ST.laba_u-bhLaba);
  // laba_akum TIDAK ditambah lagi di sini — sudah ketambahan saat visit.
  // Closing hanya memindah laba dari 'belum dibagi' (laba_u) ke 'sudah dibagi'.
  patch.week_omzet=0;patch.week_laba=0;
  const bhData={
    bh_laba:bhLaba,bh_owner:owner,bh_mitra:mitra,bh_motor:motor,bh_cad:cad,bh_pot:pot,
    bh_skema:lunas?'51/45/4':'55/35/10',
    bh_owner_status:bhOwnerStatus,bh_ilham_status:bhIlhamStatus,bh_motor_status:bhMotorStatus
  };
  const closingRow={omzet_week:ST.week_omzet,laba_week:ST.week_laba,tgl:today(),oleh:USER?USER.nama:'-',...bhData};
  try{
    const res=await sb('POST','closing',closingRow);
    if(res&&res.length)CLOSING.unshift(res[0]);else CLOSING.unshift(closingRow);
    await saveState(patch);
    await addJurnal('closing',`Closing: laba ${idr(bhLaba,true)} | keluar ${idr(totalKasBerkurang,true)} (${sumberDana})`,null,dariKas>0?{akun:'kas',keluar:dariKas}:null);
    if(dariBank>0)await addJurnal('closing',`Closing: ambil dari Mandiri ${idr(dariBank,true)}`,null,{akun:'bank',keluar:dariBank});
    setv('bh-input','');
    el('prev-bh').classList.remove('show');
    KASBON=await sb('GET','kasbon',null,'?order=created_at.desc')||[];
    toast('✅ Tutup Buku tersimpan!');renderAll();
  }catch(err){
    toast('❌ Gagal closing: '+(err.message||err)+'. Cek koneksi & coba lagi.');
    console.error('simpanClosing error:',err);
    await loadAll();renderAll();
  }
}

function renderMotor(){
  const sisa=Math.max(0,MOTOR_NILAI-ST.motor_bayar);
  const pct=Math.min(100,Math.round(ST.motor_bayar/MOTOR_NILAI*100));
  setText('motor-bayar',idr(ST.motor_bayar));setText('motor-sisa',idr(sisa));
  el('motor-bar').style.width=pct+'%';
  el('motor-badge').innerHTML=ST.motor_lunas
    ?'<span class="badge badge-green">✅ Lunas — skema 51/45/4%</span>'
    :`<span class="badge badge-amber">Belum lunas (${pct}%) — skema 55/35/10%</span>`;
}

function toggleClosing(id){
  const d=el('closing-detail-'+id);
  if(!d)return;
  const isOpen=d.style.display==='block';
  // Close all first
  document.querySelectorAll('[id^="closing-detail-"]').forEach(el=>el.style.display='none');
  // Toggle clicked one
  if(!isOpen)d.style.display='block';
}

function renderListClosing(){
  const e=el('list-closing');
  if(!CLOSING.length){e.innerHTML='<div class="empty">Belum ada tutup buku</div>';return;}
  e.innerHTML=CLOSING.map((c,i)=>{
    const cid=c.id||('idx'+i);
    return`<div class="card" style="margin-bottom:8px">
      <div onclick="toggleClosing('${cid}')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:13px">${c.tgl}</div>
          <div style="font-size:11px;color:var(--text3)">Omzet ${idr(c.omzet_week,true)} | Laba ${idr(c.laba_week,true)}</div>
        </div>
        <span class="badge ${c.bh_laba?'badge-green':'badge-gray'}">${c.bh_laba?'Bagi hasil ✓':'No BH'}</span>
      </div>
      <div id="closing-detail-${cid}" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
        <div class="row"><span class="row-label">Pemasukan minggu</span><span class="tg">${idr(c.omzet_week)}</span></div>
        <div class="row"><span class="row-label">Laba minggu</span><span class="tg">${idr(c.laba_week)}</span></div>
        ${c.bh_laba?`
        <div style="border-top:1px solid var(--border);margin:8px 0"></div>
        <div class="row"><span class="row-label tb">Bagi Hasil ${c.bh_skema}</span><span class="badge badge-green">${idr(c.bh_laba)}</span></div>
        <div class="row"><span class="row-label">👑 Bagian Syarvi</span><span class="tg">${idr(c.bh_owner)} — ${c.bh_owner_status==='ambil'?'Sudah diambil':'Belum diambil'}</span></div>
        <div class="row"><span class="row-label">🤝 Bagian Ilham</span><span>${idr(c.bh_mitra)}</span></div>
        <div class="row"><span class="row-label">✂️ Potong kasbon Ilham</span><span class="tr">${c.bh_pot>0?'-'+idr(c.bh_pot):'-'}</span></div>
        <div class="row"><span class="row-label">🤝 Ilham terima</span><span class="tg">${idr(c.bh_mitra-c.bh_pot)}</span></div>
        <div class="row"><span class="row-label">🏍 Cicilan motor</span><span>${idr(c.bh_motor)} — ${c.bh_motor_status==='bayar'?'Udah dibayar':'Belum dibayar'}</span></div>
        ${c.bh_cad?`<div class="row"><span class="row-label">💰 Dana cadangan</span><span class="tg">${idr(c.bh_cad)}</span></div>`:''}
        `:''}
      </div>
    </div>`;
  }).join('');
}

// ─── INPUT MANUAL OMZET & LABA ────────────────────────────
async function inputManualOmzet(){
  const omzet=+v('manual-omzet'),laba=+v('manual-laba');
  if(!omzet||!laba){toast('Isi omzet dan laba');return;}
  if(!confirm('Input manual:\nOmzet: '+idr(omzet)+'\nLaba: '+idr(laba)+'\n\nLanjut?'))return;
  await saveState({
    total_omzet:ST.total_omzet+omzet,laba_akum:ST.laba_akum+laba,
    laba_u:ST.laba_u+laba,week_omzet:ST.week_omzet+omzet,week_laba:ST.week_laba+laba
  });
  await addJurnal('closing',`Input manual: omzet ${idr(omzet,true)} | laba ${idr(laba,true)}`);
  setv('manual-omzet','');setv('manual-laba','');
  toast('✅ Omzet & laba berhasil diinput!');renderAll();
}

// ─── KAS & BANK ───────────────────────────────────────────
async function beliKacang(){
  const kal=+v('sup-kal'),hkal=+v('sup-hkal')||270000,
    bayar=+v('sup-bayar')||0,tgl=v('sup-tgl');
  if(!kal){toast('Isi jumlah kaleng');return;}
  const total=kal*hkal,hutangBaru=total-bayar;
  const patch={stok_kal:ST.stok_kal+kal,hutang_sup:ST.hutang_sup+hutangBaru};
  let mutasiBeli=null;
  if(bayar>0){
    // Bayar SELALU dari Mandiri (transfer)
    if(ST.bank>=bayar){
      patch.bank=ST.bank-bayar;
      mutasiBeli={akun:'bank',keluar:bayar};
    } else {
      const kurang=bayar-ST.bank;
      const ok=confirm('Saldo Mandiri tidak cukup!\nMandiri: '+idr(ST.bank)+'\nKurang: '+idr(kurang)+'\n\nTambal dari uang pribadi?\n(KBB catat utang ke owner: '+idr(kurang)+')');
      if(!ok)return;
      const bankDipakai=ST.bank;
      patch.bank=0;
      patch.utang_owner=(ST.utang_owner||0)+kurang;
      if(bankDipakai>0)mutasiBeli={akun:'bank',keluar:bankDipakai};
    }
  }
  await saveState(patch);
  await addJurnal('kas',`Beli ${kal} kaleng | total ${idr(total,true)} | bayar ${idr(bayar,true)} (Mandiri) | hutang baru ${idr(hutangBaru,true)}`,tgl,mutasiBeli);
  setv('sup-kal','');setv('sup-bayar','');
  toast(`✅ ${kal} kaleng dicatat!`);renderAll();
}

async function bayarSupplier(){
  const nom=+v('hs-nom'),tgl=v('hs-tgl');
  if(!nom){toast('Isi nominal');return;}
  // Bayar supplier SELALU dari Mandiri (transfer)
  const patch={hutang_sup:Math.max(0,ST.hutang_sup-nom)};
  if(ST.bank>=nom){
    // Mandiri cukup - bayar normal
    patch.bank=ST.bank-nom;
    await saveState(patch);
    await addJurnal('kas',`Bayar supplier ${idr(nom,true)} dari Mandiri`,tgl,{akun:'bank',keluar:nom});
    setv('hs-nom','');
    toast('✅ Pembayaran supplier dicatat!');renderAll();
  } else {
    // Mandiri kurang - tawarkan tambal dari uang pribadi
    const kurang=nom-ST.bank;
    const tambal=confirm(
      'Saldo Mandiri tidak cukup!\n\n'+
      'Mau bayar: '+idr(nom)+
      '\nMandiri tersedia: '+idr(ST.bank)+
      '\nKekurangan: '+idr(kurang)+
      '\n\nTambal '+idr(kurang)+' dari uang pribadi lo?'+
      '\n(KBB akan catat utang ke owner sebesar '+idr(kurang)+')'
    );
    if(!tambal)return;
    const bankDipakai=ST.bank;
    patch.bank=0;
    patch.utang_owner=(ST.utang_owner||0)+kurang;
    await saveState(patch);
    await addJurnal('kas',`Bayar supplier ${idr(nom,true)} | Mandiri ${idr(bankDipakai,true)} + pribadi ${idr(kurang,true)}`,tgl,bankDipakai>0?{akun:'bank',keluar:bankDipakai}:null);
    setv('hs-nom','');
    toast('✅ Supplier dibayar! KBB utang ke lo: '+idr(kurang));renderAll();
  }
}

async function simpanOps(){
  const nom=+v('op-nom'),ket=v('op-ket'),tgl=v('op-tgl'),jenis=v('op-jenis');
  if(!nom){toast('Isi nominal');return;}
  const patch={};
  if(ST.kas>=nom){
    patch.kas=ST.kas-nom;
    await saveState(patch);
    await addJurnal('kas',`${jenis}: ${ket||'-'} | ${idr(nom,true)}`,tgl,{akun:'kas',keluar:nom});
    setv('op-nom','');setv('op-ket','');
    toast('✅ Pengeluaran dicatat!');renderAll();
  } else {
    const kurang=nom-ST.kas;
    const tambal=confirm(
      'Kas tidak cukup!\nKas: '+idr(ST.kas)+'\nKurang: '+idr(kurang)+
      '\n\nTambal dari uang pribadi lo?\n(KBB catat utang ke owner: '+idr(kurang)+')'
    );
    if(!tambal)return;
    const kasDipakai=ST.kas;
    patch.kas=0;
    patch.utang_owner=(ST.utang_owner||0)+kurang;
    await saveState(patch);
    await addJurnal('kas',`${jenis}: ${ket||'-'} | ${idr(nom,true)} (pribadi: ${idr(kurang,true)})`,tgl,kasDipakai>0?{akun:'kas',keluar:kasDipakai}:null);
    setv('op-nom','');setv('op-ket','');
    toast('✅ Pengeluaran dicatat! KBB utang ke lo: '+idr(kurang));renderAll();
  }
}

// ─── UPDATE SALDO ─────────────────────────────────────────
let _updateSaldoTipe=null;
function bukaUpdateSaldo(tipe){
  _updateSaldoTipe=tipe;
  const label=tipe==='kas'?'Uang Kas':'Bank Mandiri';
  const nilai=tipe==='kas'?ST.kas:ST.bank;
  setText('us-title','✏️ Update '+label);
  setText('us-current',idr(nilai));
  setv('us-nom','');setv('us-ket','');
  openModal('modal-update-saldo');
}

async function simpanUpdateSaldo(){
  const nomBaru=+v('us-nom');
  const ket=v('us-ket').trim();
  if(v('us-nom')===''){toast('Isi saldo baru');return;}
  if(nomBaru<0){toast('Saldo tidak boleh negatif');return;}
  const nilaiLama=_updateSaldoTipe==='kas'?ST.kas:ST.bank;
  const selisih=nomBaru-nilaiLama;
  const label=_updateSaldoTipe==='kas'?'Kas':'Bank Mandiri';
  if(!confirm(`Update saldo ${label}?\n\nDari: ${idr(nilaiLama)}\nJadi: ${idr(nomBaru)}\nSelisih: ${selisih>=0?'+':''}${idr(selisih)}\n\nLanjut?`))return;
  const patch={};
  if(_updateSaldoTipe==='kas')patch.kas=nomBaru;else patch.bank=nomBaru;
  await saveState(patch);
  const akunMut=_updateSaldoTipe==='kas'?'kas':'bank';
  const mutSaldo=selisih>0?{akun:akunMut,masuk:selisih}:(selisih<0?{akun:akunMut,keluar:-selisih}:null);
  await addJurnal('kas',`Update saldo ${label}: ${idr(nilaiLama,true)} → ${idr(nomBaru,true)} (${selisih>=0?'+':''}${idr(selisih,true)})${ket?' | '+ket:''}`,today(),mutSaldo);
  closeModal('modal-update-saldo');
  toast('✅ Saldo '+label+' diupdate jadi '+idr(nomBaru));
  renderAll();
}

// ─── PIUTANG OWNER ────────────────────────────────────────
function bukaRiwayatUtangOwner(){
  setText('uo-total',idr(ST.utang_owner||0));
  // Ambil jurnal yang menambah/mengurangi utang owner
  const riwayat=JURNAL.filter(j=>j.keterangan&&(
    j.keterangan.includes('pribadi')||
    j.keterangan.includes('utang ke lo')||
    j.keterangan.includes('Owner ambil piutang')||
    j.keterangan.includes('Pribadi -')
  ));
  const e=el('uo-list');
  if(!riwayat.length){e.innerHTML='<div class="empty">Belum ada riwayat utang owner</div>';openModal('modal-utang-owner');return;}
  e.innerHTML=riwayat.slice(0,50).map(j=>{
    const masuk=j.keterangan.includes('Owner ambil piutang');
    return`<div class="row" style="padding:8px 0;border-bottom:0.5px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--text2)">${j.keterangan}</div>
        <div style="font-size:11px;color:var(--text3)">${j.tgl}</div>
      </div>
      <span class="badge ${masuk?'badge-green':'badge-amber'}" style="flex-shrink:0;margin-left:6px">${masuk?'diambil':'+utang'}</span>
    </div>`;
  }).join('');
  openModal('modal-utang-owner');
}

async function ambilPiutangOwner(){
  const nom=+v('po-nom');
  if(!nom){toast('Isi nominal');return;}
  if(nom>(ST.utang_owner||0)){toast('Melebihi utang KBB ke lo: '+idr(ST.utang_owner));return;}
  if(ST.kas<nom){toast('Kas tidak cukup');return;}
  await saveState({
    kas:ST.kas-nom,
    utang_owner:Math.max(0,(ST.utang_owner||0)-nom)
  });
  await addJurnal('kas',`Owner ambil piutang ${idr(nom,true)} dari kas`,null,{akun:'kas',keluar:nom});
  setv('po-nom','');
  toast('✅ Piutang owner diambil: '+idr(nom));renderAll();
}

// ─── SETOR KAS ────────────────────────────────────────────
async function setorKas(){
  const nom=+v('sk-nom'),ket=v('sk-ket'),tgl=v('sk-tgl');
  if(!nom){toast('Isi nominal');return;}
  if(!ket.trim()){toast('Isi keterangan');return;}
  if(!confirm('Setor kas '+idr(nom)+'?\nKeterangan: '+ket+'\n\nLanjut?'))return;
  await saveState({kas:ST.kas+nom});
  await addJurnal('kas',`Setor kas: ${ket} | +${idr(nom,true)}`,tgl,{akun:'kas',masuk:nom});
  setv('sk-nom','');setv('sk-ket','');
  closeModal('modal-setor-kas');
  toast('✅ Kas +'+idr(nom,true));renderAll();
}

async function setorKasKeMandiri(){
  const nom=+v('skm-nom');
  if(!nom||nom<=0){toast('Isi nominal setor');return;}
  if(nom>ST.kas){toast('Kas tidak cukup! Kas: '+idr(ST.kas));return;}
  if(!confirm(`Setor kas ke Mandiri?\n\nKas -${idr(nom)} → Mandiri +${idr(nom)}\n\nKas: ${idr(ST.kas)} → ${idr(ST.kas-nom)}\nMandiri: ${idr(ST.bank)} → ${idr(ST.bank+nom)}\n\nLanjut?`))return;
  await saveState({kas:ST.kas-nom,bank:ST.bank+nom});
  await addJurnal('kas',`Setor kas ke Mandiri: Kas -${idr(nom,true)} → Mandiri +${idr(nom,true)}`,today(),{akun:'kas',keluar:nom});
  await addJurnal('kas',`Terima setoran dari kas: +${idr(nom,true)}`,today(),{akun:'bank',masuk:nom});
  setv('skm-nom','');
  toast('✅ '+idr(nom)+' disetor ke Mandiri');renderAll();
}

// ─── DAFTAR BON ───────────────────────────────────────────
function renderDaftarBon(){
  const list=OUTLETS.filter(o=>(o.piutang||0)>0).sort((a,b)=>b.piutang-a.piutang);
  const el2=el('list-daftar-bon');
  if(!el2)return;
  if(!list.length){el2.innerHTML='<div class="empty">Tidak ada bon belum lunas 🎉</div>';return;}
  el2.innerHTML=list.map(o=>`
    <div class="row" style="padding:8px 0;border-bottom:0.5px solid var(--border)">
      <div>
        <div class="tb" style="font-size:13px">${o.nama}</div>
        <div style="font-size:11px;color:var(--text3)">${o.alamat||'-'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="tr tb">${idr(o.piutang)}</span>
        <button class="btn btn-sm" style="font-size:11px" onclick="lunasiBonn('${o.id}','${o.nama}',${o.piutang})">Lunasi</button>
      </div>
    </div>`).join('');
  const total=list.reduce((s,o)=>s+(o.piutang||0),0);
  setText('total-daftar-bon',idr(total));
}


// ─── LUNASI BON ───────────────────────────────────────────
let _lunasiOutletId=null,_lunasiOutletNama=null,_lunasiBonAda=0;

function lunasiBonn(outletId,outletNama,bonAda){
  _lunasiOutletId=outletId;
  _lunasiOutletNama=outletNama;
  _lunasiBonAda=bonAda;
  setText('lunasi-nama',outletNama);
  setText('lunasi-ada',idr(bonAda));
  setv('lunasi-nom','');
  openModal('modal-lunasi-bon');
}

async function konfirmasiLunasi(){
  const nom=+v('lunasi-nom');
  if(!nom||nom<=0){toast('Isi nominal');return;}
  if(nom>_lunasiBonAda){toast('Melebihi bon yang ada: '+idr(_lunasiBonAda));return;}
  if(ST.kas<nom){toast('Kas tidak cukup: '+idr(ST.kas));return;}
  const o=OUTLETS.find(o=>o.id===_lunasiOutletId);
  if(!o)return;
  const newPiutang=Math.max(0,(o.piutang||0)-nom);
  await sb('PATCH','outlets',{piutang:newPiutang},'?id=eq.'+_lunasiOutletId);
  const oIdx=OUTLETS.findIndex(x=>x.id===_lunasiOutletId);
  if(oIdx>=0)OUTLETS[oIdx]={...o,piutang:newPiutang};
  // Piutang dihitung dari total outlet (jangan kurangi ST.piutang manual = dobel)
  await saveState({kas:ST.kas+nom,piutang:outletPiutangTotal()});
  await addJurnal('kas',`Lunasi bon ${_lunasiOutletNama}: +${idr(nom,true)}`,today(),{akun:'kas',masuk:nom});
  closeModal('modal-lunasi-bon');
  toast('✅ Bon '+_lunasiOutletNama+' dilunasi '+idr(nom));
  renderDaftarBon();
  renderAll();
}

// ─── KASBON ───────────────────────────────────────────────
async function simpanKasbon(){
  const nom=+v('kb-nom'),ket=v('kb-ket'),tgl=v('kb-tgl');
  if(!nom){toast('Isi nominal');return;}
  const kasDipakaiKasbon=Math.min(ST.kas,nom);
  if(ST.kas<nom){
    const ok=confirm('Kas tidak cukup!\nKas: '+idr(ST.kas)+'\nKurang: '+idr(nom-ST.kas)+'\n\nTambal dari uang pribadi lo?\n(KBB catat utang ke owner)');
    if(!ok)return;
    const kurang=nom-ST.kas;
    await saveState({kas:0,utang_owner:(ST.utang_owner||0)+kurang});
  } else {
    await saveState({kas:ST.kas-nom});
  }
  // Tambah ke kasbon aktif
  const aktif=KASBON.find(k=>!k.lunas);
  if(aktif){
    const newNom=aktif.nom+nom;
    await sb('PATCH','kasbon',{nom:newNom},'?id=eq.'+aktif.id);
    aktif.nom=newNom;
  } else {
    const row={nom,ket:'Kasbon Ilham',tgl,lunas:false};
    const res=await sb('POST','kasbon',row);
    if(res&&res.length)KASBON.unshift(res[0]);else KASBON.unshift(row);
  }
  await addJurnal('kas',`Kasbon Ilham: ${ket||'-'} ${idr(nom,true)} (kas -${idr(nom,true)})`,tgl,kasDipakaiKasbon>0?{akun:'kas',keluar:kasDipakaiKasbon}:null);
  setv('kb-nom','');setv('kb-ket','');
  closeModal('modal-kasbon');
  toast('✅ Kasbon +'+idr(nom,true)+' | Kas -'+idr(nom,true));
  renderAll();
}

async function hapusKasbon(id){
  if(!confirm('Hapus kasbon ini?'))return;
  await sb('DELETE','kasbon',null,'?id=eq.'+id);
  KASBON=KASBON.filter(k=>k.id!==id);
  toast('✅ Kasbon dihapus');renderAll();
}

function renderKasbonList(){
  const total=kasbonAktif();
  setText('kb-kasbon-tot',idr(total));
  setText('cl-kasbon',idr(total));
  const e=el('list-kasbon');

  // Riwayat kasbon dari jurnal
  const riwayat=JURNAL.filter(j=>j.tipe==='kas'&&j.keterangan&&j.keterangan.includes('Kasbon Ilham'));

  e.innerHTML=`
    <div class="card" style="margin-bottom:8px">
      <div class="row"><span class="row-label tb">Total kasbon aktif</span><span class="tr tb">${idr(total)}</span></div>
      ${total>0?`
      <div style="border-top:1px solid var(--border);margin:8px 0;font-size:12px;color:var(--text3)">Riwayat pengambilan:</div>
      ${riwayat.slice(0,10).map(j=>`
        <div class="row" style="font-size:12px">
          <span style="color:var(--text2)">${j.keterangan.replace('Kasbon Ilham: ','')}</span>
          <span style="color:var(--text3)">${j.tgl}</span>
        </div>`).join('')}
      `:'<div style="font-size:12px;color:var(--text3);margin-top:4px">Tidak ada kasbon aktif</div>'}
    </div>`;
}

// ─── JURNAL ───────────────────────────────────────────────
function renderJurnal(){
  const q=(v('j-search')||'').toLowerCase();
  const f=v('j-filter');
  const list=JURNAL.filter(j=>(!q||(j.keterangan||'').toLowerCase().includes(q))&&(!f||j.tipe===f));
  const e=el('list-jurnal');
  if(!list.length){e.innerHTML='<div class="empty">Tidak ada transaksi</div>';return;}
  const tc={produksi:'badge-blue',visit:'badge-green',closing:'badge-green',kas:'badge-amber',outlet:'badge-gray',setup:'badge-gray'};
  e.innerHTML=list.slice(0,80).map(j=>`
    <div class="j-item">
      <div style="flex:1;min-width:0">
        <div class="j-title">${j.keterangan||'-'}</div>
        <div class="j-meta">${j.tgl}</div>
      </div>
      <span class="badge ${tc[j.tipe]||'badge-gray'}" style="flex-shrink:0;margin-left:6px">${j.tipe}</span>
    </div>`).join('');
}

// ─── RESET ────────────────────────────────────────────────
async function resetData(){
  const pwd=prompt('Masukkan password reset:');
  if(pwd!=='8888'){toast('❌ Password salah!');return;}
  if(!confirm('⚠️ HAPUS SEMUA DATA?\n\nLanjut?'))return;
  if(!confirm('❗ YAKIN BANGET?\nTidak bisa dikembalikan.'))return;
  toast('Menghapus data...',5000);
  try{
    await sb('DELETE','visits',null,'?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE','kasbon',null,'?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE','closing',null,'?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE','jurnal',null,'?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE','produksi',null,'?id=neq.00000000-0000-0000-0000-000000000000');
    await sb('DELETE','outlets',null,'?id=neq.00000000-0000-0000-0000-000000000000');
    await saveState({kas:0,bank:0,stok_kal:0,gudang:0,piutang:0,hutang_sup:4320000,dana_cad:0,modal:15000000,laba_akum:0,laba_u:0,motor_bayar:0,motor_lunas:false,total_omzet:0,total_hpp:0,week_omzet:0,week_laba:0,setup:false});
    OUTLETS=[];PRODUKSI=[];VISITS=[];KASBON=[];CLOSING=[];JURNAL=[];
    toast('✅ Semua data berhasil dihapus!');renderAll();
  }catch(e){toast('Gagal: '+e.message);console.error(e);}
}

// ─── IMPORT OUTLET ────────────────────────────────────────
function downloadTemplate(){
  const csv='NAMA,ALAMAT,STOK_AWAL,TANGGAL_PENGISIAN_TERAKHIR\nWarung Bu Sari,Jl. Merdeka No.1,25,2026-05-24\nWarkop Pak Joko,Jl. Sudirman No.5,50,2026-05-20';
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='template_outlet_KBB.csv';a.click();
}

async function importOutlet(){
  const file=el('import-file').files[0];
  if(!file){toast('Pilih file dulu');return;}
  const text=await file.text();
  const lines=text.trim().split('\n');
  const rows=lines.slice(1).filter(l=>l.trim());
  if(!rows.length){toast('File kosong atau format salah');return;}
  const preview=[];
  for(const row of rows){
    const cols=row.split(/[,;]/).map(c=>c.trim().replace(/^"|"$/g,''));
    if(!cols[0])continue;
    preview.push({nama:cols[0]||'',alamat:cols[1]||'',stok:parseInt(cols[2])||0,last_visit:cols[3]||null});
  }
  if(!preview.length){toast('Tidak ada data valid');return;}
  el('import-preview-list').innerHTML=preview.map(o=>`
    <div class="row"><span style="font-size:12px">${o.nama} — ${o.alamat||'-'}</span><span class="badge badge-gray">${o.stok} bungkus</span></div>`).join('');
  el('import-preview').style.display='block';
  el('import-preview').dataset.rows=JSON.stringify(preview);
  setText('import-count',preview.length+' kedai siap diimport');
}

async function konfirmasiImport(){
  const rows=JSON.parse(el('import-preview').dataset.rows||'[]');
  if(!rows.length)return;
  let sukses=0,gagal=0;
  toast('Mengimport '+rows.length+' kedai...',10000);
  for(const o of rows){
    try{
      const row={nama:o.nama,alamat:o.alamat,stok:o.stok||0,last_visit:o.last_visit||null,total_laku:0,total_omzet:0,tgl_mulai:today()};
      const res=await sb('POST','outlets',row);
      if(res&&res.length)OUTLETS.push(res[0]);else OUTLETS.push(row);
      sukses++;
    }catch(e){gagal++;console.error(e);}
  }
  el('import-preview').style.display='none';el('import-file').value='';
  closeModal('modal-import');
  await addJurnal('outlet',`Import ${sukses} kedai dari Excel`);
  toast(`✅ ${sukses} kedai berhasil diimport${gagal>0?' | '+gagal+' gagal':''}`);
  renderAll();
}

// ─── INIT ─────────────────────────────────────────────────
async function init(){
  const saved=sessionStorage.getItem('kbb_user');
  if(saved){
    USER=JSON.parse(saved);ROLE=USER.role;
    showApp();setupNav();setDates();
    await loadAll();renderAll();
  }else{showLogin();}
}
init();
