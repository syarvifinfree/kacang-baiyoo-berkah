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
  ['pr-tgl','v-tgl','sup-tgl','hs-tgl','op-tgl','kb-tgl','no-tgl'].forEach(id=>{
    const e=el(id);if(e&&!e.value)e.value=t;
  });
}
function toast(msg,dur=2500){
  const t=el('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),dur);
}
function kasbonAktif(){return KASBON.filter(k=>!k.lunas).reduce((s,k)=>s+(k.nom||0),0);}
function lastHPP(){return PRODUKSI.length?PRODUKSI[0].hpp:1150;}
function kedaiStokTotal(){return OUTLETS.reduce((s,o)=>s+(o.stok||0),0);}

function gp(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  el('page-'+id).classList.add('active');
  if(btn)btn.classList.add('active');
  renderAll();
}
function openModal(id){el(id).classList.add('open');}
function closeModal(id){el(id).classList.remove('open');}
function closeModalOut(e,id){if(e.target.id===id)closeModal(id);}

async function addJurnal(tipe,ket,tgl=null){
  const row={tipe,keterangan:ket,tgl:tgl||today()};
  await sb('POST','jurnal',row);
  JURNAL.unshift(row);
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
      setv('login-pin','');return;
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
  const pinBaru=prompt('Masukkan PIN baru (4-6 angka):');
  if(!pinBaru||pinBaru.length<4){alert('PIN minimal 4 angka');return;}
  await sb('PATCH','users',{pin:pinBaru},`?id=eq.${USER.id}`);
  USER.pin=pinBaru;
  sessionStorage.setItem('kbb_user',JSON.stringify(USER));
  toast('✅ PIN berhasil diganti!');
}

function pinInput(val){
  const cur=v('login-pin');
  if(val==='del'){setv('login-pin',cur.slice(0,-1));}
  else if(cur.length<6){setv('login-pin',cur+val);}
  el('pin-dots').innerHTML=v('login-pin').split('').map(()=>'<span class="pin-dot filled"></span>').join('')+
    Array(6-v('login-pin').length).fill('<span class="pin-dot"></span>').join('');
}

function setupNav(){
  if(ROLE==='mitra'){
    document.querySelectorAll('.nav-btn').forEach(b=>{
      if(['Neraca','Closing','Jurnal'].includes(b.textContent.trim()))b.style.display='none';
    });
    const firstBtn=document.querySelector('.nav-btn:not([style*="none"])');
    if(firstBtn){
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      const pageId=firstBtn.getAttribute('onclick').match(/gp\('(\w+)'/)[1];
      el('page-'+pageId).classList.add('active');
      firstBtn.classList.add('active');
    }
  }
}

// ─── LOAD DATA ────────────────────────────────────────────
async function loadAll(){
  try{
    await getState();
    OUTLETS=await sb('GET','outlets',null,'?order=created_at.asc')||[];
    PRODUKSI=await sb('GET','produksi',null,'?order=created_at.desc&limit=20')||[];
    VISITS=await sb('GET','visits',null,'?order=created_at.desc&limit=50')||[];
    KASBON=await sb('GET','kasbon',null,'?order=created_at.desc')||[];
    CLOSING=await sb('GET','closing',null,'?order=created_at.desc&limit=10')||[];
    JURNAL=await sb('GET','jurnal',null,'?order=created_at.desc&limit=100')||[];
  }catch(e){toast('Gagal koneksi ke database');console.error(e);}
}

// ─── RENDER ALL ───────────────────────────────────────────
function renderAll(){
  if(!USER)return;
  renderNeraca();renderMotor();renderKasbonList();
  renderOutlets();renderAlarm();renderVisitSelect();
  renderListProd();renderListVisit();renderListClosing();renderJurnal();
  updateClosingSum();
  setText('top-tgl',new Date().toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'}));
  setText('top-user',USER.nama);
  const needVisit=OUTLETS.filter(o=>daysSince(o.last_visit)>=7).length;
  const ok=ST.laba_u>=0&&ST.piutang<2000000&&needVisit===0;
  const hBadge=el('top-health');
  hBadge.textContent=ok?'✅ Sehat':'⚠️ Cek';
  hBadge.className='badge '+(ok?'badge-green':'badge-amber');
}

// ─── NERACA ───────────────────────────────────────────────
function renderNeraca(){
  setText('n-kas',idr(ST.kas,true));setText('n-bank',idr(ST.bank,true));
  setText('n-kal',ST.stok_kal+' kaleng');setText('n-gudang',ST.gudang+' bungkus');
  setText('n-outlet-stok',outletStokTotal()+' bungkus');
  setText('n-piutang',idr(ST.piutang,true));setText('n-hsup',idr(ST.hutang_sup,true));
  setText('n-cad',idr(ST.dana_cad,true));setText('n-modal',idr(ST.modal,true));
  setText('n-laba',idr(ST.laba_akum,true));setText('n-labau',idr(ST.laba_u,true));
  setText('kb-kas',idr(ST.kas,true));setText('kb-bank',idr(ST.bank,true));
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
  setk('k2',ST.piutang<2000000,'Aman','Bon numpuk');
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
  if(ROLE!=='owner'){toast('Hanya owner');return;}
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
  if(ROLE!=='owner'){toast('Hanya owner');return;}
  const kal=+v('pr-kal'),hkal=+v('pr-hkal')||270000,
    bungkus=+v('pr-bungkus'),upah=+v('pr-upah')||80,
    plastik=+v('pr-plastik')||45,tgl=v('pr-tgl');
  if(!kal||!bungkus){toast('Isi kaleng dan hasil bungkus');return;}
  if(ST.stok_kal<kal){toast('Stok kaleng kurang! (ada: '+ST.stok_kal+')');return;}
  const hppKacang=Math.round((kal*hkal)/bungkus);
  const hppEstimasi=hppKacang+upah+plastik;
  const totUpah=upah*bungkus;
  // Catat utang upah ke neraca
  const row={kal,hkal,bungkus,upah,plastik,hpp:hppEstimasi,tot_kas:0,tgl,upah_lunas:false};
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
  if(ROLE!=='owner'){toast('Hanya owner');return;}
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
  await saveState(patch);
  await addJurnal('kas',`Bayar upah packing ${bungkus} bungkus: ${idr(totUpah)}`);
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
      ${ROLE==='owner'&&!p.upah_lunas?`<button class="btn btn-primary btn-sm" style="margin-top:6px;margin-right:6px" onclick="bayarUpah('${p.id}',${p.bungkus},${p.upah||0})">💰 Bayar Upah</button>`:''}
      ${ROLE==='owner'?`<button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="hapusProduksi('${p.id}',${p.kal},${p.bungkus},${p.upah||0},${p.upah_lunas?'true':'false'})">🗑 Hapus</button>`:''}
    </div>`;
  }).join('');
}

// ─── OUTLET ───────────────────────────────────────────────
async function simpanOutlet(){
  const nama=v('no-nama').trim(),alamat=v('no-alamat').trim(),tgl=v('no-tgl');
  if(!nama){toast('Isi nama warung');return;}
  const row={nama,alamat,stok:0,last_visit:null,total_laku:0,total_omzet:0,tgl_mulai:tgl};
  const res=await sb('POST','outlets',row);
  if(res&&res.length)OUTLETS.push(res[0]);else OUTLETS.push(row);
  setv('no-nama','');setv('no-alamat','');
  closeModal('modal-outlet');
  await addJurnal('outlet',`Kedai baru: ${nama}`,tgl);
  toast('✅ Outlet '+nama+' ditambahkan');renderAll();
}

async function hapusOutlet(id,nama){
  if(!confirm('Hapus kedai '+nama+'?'))return;
  await sb('DELETE','outlets',null,'?id=eq.'+id);
  OUTLETS=OUTLETS.filter(o=>o.id!==id);
  toast('✅ Kedai dihapus');renderAll();
}

async function editOutletStok(id,nama,stokLama){
  const stokBaru=prompt(`Edit stok "${nama}" (sekarang: ${stokLama} bungkus):`);
  if(stokBaru===null)return;
  const stok=parseInt(stokBaru);
  if(isNaN(stok)||stok<0){alert('Angka tidak valid');return;}
  await sb('PATCH','outlets',{stok},`?id=eq.${id}`);
  const o=OUTLETS.find(o=>o.id===id);if(o)o.stok=stok;
  toast('✅ Stok kedai diupdate');renderAll();
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
      ${ROLE==='owner'?`
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-sm" onclick="editOutletStok('${o.id}','${o.nama}',${o.stok})" style="flex:1">✏️ Edit Stok</button>
        <button class="btn btn-danger btn-sm" onclick="hapusOutlet('${o.id}','${o.nama}')" style="flex:1">🗑 Hapus</button>
      </div>`:''}
    </div>`;
  }).join('');
}

// ─── VISIT ────────────────────────────────────────────────
function renderAlarm(){
  const urgent=OUTLETS.filter(o=>daysSince(o.last_visit)>=7).sort((a,b)=>daysSince(b.last_visit)-daysSince(a.last_visit));
  const e=el('alarm-list');
  if(!urgent.length){e.innerHTML='<div class="alert alert-ok">✅ Semua kedai sudah dikunjungi minggu ini</div>';return;}
  e.innerHTML=urgent.map(o=>{
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
}

function renderVisitSelect(){
  const sel=el('v-outlet');if(!sel)return;
  const areaSel=el('v-area');
  const selectedArea=areaSel?areaSel.value:'';
  if(areaSel){
    const areas=[...new Set(OUTLETS.map(o=>o.alamat||'').filter(a=>a))].sort();
    const curArea=areaSel.value;
    areaSel.innerHTML='<option value="">-- semua area --</option>'+
      areas.map(a=>`<option value="${a}" ${curArea===a?'selected':''}>${a}</option>`).join('');
  }
  const cur=sel.value;
  const filtered=OUTLETS.filter(o=>!selectedArea||o.alamat===selectedArea);
  sel.innerHTML='<option value="">-- pilih warung --</option>'+
    filtered.map(o=>`<option value="${o.id}" ${cur===o.id?'selected':''}>${o.nama}</option>`).join('');
}

function filterOutletByArea(){
  const areaSel=el('v-area'),sel=el('v-outlet');
  if(!sel||!areaSel)return;
  const selectedArea=areaSel.value;
  const filtered=OUTLETS.filter(o=>!selectedArea||o.alamat===selectedArea);
  sel.innerHTML='<option value="">-- pilih warung --</option>'+
    filtered.map(o=>`<option value="${o.id}">${o.nama}</option>`).join('');
  el('prev-visit').classList.remove('show');
  el('prev-v-info').style.display='none';
}

function prevVisitOutlet(){
  const id=v('v-outlet');
  const info=el('prev-v-info');
  if(!id){if(info)info.style.display='none';return;}
  const o=OUTLETS.find(o=>o.id===id);
  if(!o){if(info)info.style.display='none';return;}
  setText('pvi-stok',o.stok+' bungkus');
  const d=daysSince(o.last_visit);
  setText('pvi-last',o.last_visit?o.last_visit+' ('+d+' hari lalu)':'Belum pernah');
  if(info)info.style.display='block';
  calcVisit();
}

function calcVisit(){
  const id=v('v-outlet');
  if(!id||v('v-sisa')===''){el('prev-visit').classList.remove('show');return;}
  const o=OUTLETS.find(o=>o.id===id);
  if(!o){el('prev-visit').classList.remove('show');return;}
  const sisa=+v('v-sisa'),refill=+v('v-refill')||0,rusak=+v('v-rusak')||0;
  const laku=Math.max(0,o.stok-sisa);
  const returGudang=Math.max(0,sisa-rusak);
  const omzet=laku*HARGA_JUAL,hpp=lastHPP(),laba=laku*(HARGA_JUAL-hpp);
  setText('pv-laku',laku+' bungkus');
  setText('pv-omzet',idr(omzet));
  setText('pv-laba',idr(laba));
  setText('pv-retur',returGudang+' bungkus balik ke gudang'+(rusak>0?' ('+rusak+' rusak dibuang)':''));
  setText('pv-stok-baru',refill+' bungkus');
  // Warning kalau gudang kosong tapi mau refill
  const refillWarn=el('refill-warning');
  if(refillWarn)refillWarn.style.display=(refill>0&&ST.gudang===0)?'block':'none';
  el('prev-visit').classList.add('show');
}

async function simpanVisit(){
  const id=v('v-outlet');
  if(!id){toast('Pilih kedai dulu');return;}
  if(v('v-sisa')===''){toast('Isi sisa bungkus');return;}
  const o=OUTLETS.find(o=>o.id===id);
  if(!o){toast('Outlet tidak ditemukan');return;}
  const sisa=+v('v-sisa'),refill=+v('v-refill')||0,rusak=+v('v-rusak')||0;
  const laku=Math.max(0,o.stok-sisa);
  const omzet=laku*HARGA_JUAL,hpp=lastHPP(),laba=laku*(HARGA_JUAL-hpp);
  const bayarKe=v('v-bayar-ke'),bayarNom=+v('v-bayar-nom')||0;
  const tgl=v('v-tgl');
  if(refill>0&&ST.gudang===0){
    toast('⚠️ Stok Ilham kosong! Tidak bisa isi ulang.');
    return;
  }
  if(refill>ST.gudang){toast('Stok Ilham tidak cukup! (ada: '+ST.gudang+' bungkus)');return;}
  const newStok=refill-rusak;
  await sb('PATCH','outlets',{stok:newStok,last_visit:tgl,total_laku:(o.total_laku||0)+laku,total_omzet:(o.total_omzet||0)+omzet},'?id=eq.'+o.id);
  const oIdx=OUTLETS.findIndex(x=>x.id===id);
  if(oIdx>=0)OUTLETS[oIdx]={...o,stok:newStok,last_visit:tgl,total_laku:(o.total_laku||0)+laku,total_omzet:(o.total_omzet||0)+omzet};
  const visitRow={outlet_id:o.id,outlet_nama:o.nama,stok_awal:o.stok,sisa,laku,refill,rusak,omzet,laba,hpp,bayar_ke:bayarKe,bayar_nom:bayarNom,tgl};
  const res=await sb('POST','visits',visitRow);
  if(res&&res.length)VISITS.unshift(res[0]);else VISITS.unshift(visitRow);
  const stPatch={
    gudang:ST.gudang-refill+(sisa-rusak),
    total_omzet:ST.total_omzet+omzet,total_hpp:ST.total_hpp+laku*hpp,
    laba_akum:ST.laba_akum+laba,laba_u:ST.laba_u+laba,
    week_omzet:ST.week_omzet+omzet,week_laba:ST.week_laba+laba
  };
  if(bayarKe==='kas')stPatch.kas=ST.kas+bayarNom;
  else if(bayarKe==='bank')stPatch.bank=ST.bank+bayarNom;
  else if(bayarKe==='bon')stPatch.piutang=ST.piutang+bayarNom;
  await saveState(stPatch);
  await addJurnal('visit',`Kunjungan ${o.nama}: ${laku} terjual | pemasukan ${idr(omzet,true)} | refill ${refill}`,tgl);
  setv('v-sisa','');setv('v-refill','');setv('v-bayar-nom','');setv('v-rusak','0');
  el('prev-visit').classList.remove('show');
  el('prev-v-info').style.display='none';
  setv('v-area','');
  renderVisitSelect();
  toast(`✅ Kunjungan ${o.nama}: ${laku} bungkus laku`);
  renderAll();
}

async function hapusVisit(id,laku,omzet,laba,hpp,bayarKe,bayarNom,refill,sisa,rusak,outletId,stokLama){
  if(!confirm('Hapus data visit ini? Stok & keuangan akan dibalikkan.'))return;
  await sb('DELETE','visits',null,'?id=eq.'+id);
  VISITS=VISITS.filter(v=>v.id!==id);
  const o=OUTLETS.find(o=>o.id===outletId);
  if(o){
    await sb('PATCH','outlets',{stok:stokLama,total_laku:Math.max(0,(o.total_laku||0)-laku),total_omzet:Math.max(0,(o.total_omzet||0)-omzet)},'?id=eq.'+outletId);
    o.stok=stokLama;o.total_laku=Math.max(0,(o.total_laku||0)-laku);o.total_omzet=Math.max(0,(o.total_omzet||0)-omzet);
  }
  const stPatch={
    gudang:ST.gudang+refill-sisa+rusak,
    total_omzet:Math.max(0,ST.total_omzet-omzet),
    laba_akum:Math.max(0,ST.laba_akum-laba),laba_u:Math.max(0,ST.laba_u-laba),
    week_omzet:Math.max(0,ST.week_omzet-omzet),week_laba:Math.max(0,ST.week_laba-laba)
  };
  if(bayarKe==='kas')stPatch.kas=ST.kas-bayarNom;
  else if(bayarKe==='bank')stPatch.bank=ST.bank-bayarNom;
  else if(bayarKe==='bon')stPatch.piutang=Math.max(0,ST.piutang-bayarNom);
  await saveState(stPatch);
  toast('✅ Kunjungan dihapus & data dibalikkan');renderAll();
}

function renderListVisit(){
  const e=el('list-visit');
  if(!VISITS.length){e.innerHTML='<div class="empty">Belum ada visit</div>';return;}
  e.innerHTML=VISITS.slice(0,15).map(v=>`
    <div class="card" style="margin-bottom:8px">
      <div class="row"><span class="row-label tb">${v.outlet_nama}</span><span style="color:var(--text3)">${v.tgl}</span></div>
      <div class="row"><span class="row-label">Laku</span><span class="tg tb">${v.laku} bungkus</span></div>
      <div class="row"><span class="row-label">Omzet</span><span class="tg">${idr(v.omzet)}</span></div>
      <div class="row"><span class="row-label">Sisa balik gudang</span><span>${v.sisa} bungkus</span></div>
      <div class="row"><span class="row-label">Isi ulang</span><span>${v.refill} bungkus</span></div>
      ${v.rusak?`<div class="row"><span class="row-label">Rusak</span><span class="tr">${v.rusak} bungkus</span></div>`:''}
      <div class="row"><span class="row-label">Bayar</span><span>${idr(v.bayar_nom)} → ${v.bayar_ke==='bon'?'bon':v.bayar_ke}</span></div>
      ${ROLE==='owner'?`<button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="hapusVisit('${v.id}',${v.laku},${v.omzet},${v.laba},${v.hpp},'${v.bayar_ke}',${v.bayar_nom},${v.refill},${v.sisa},${v.rusak||0},'${v.outlet_id}',${v.stok_awal})">🗑 Hapus Visit</button>`:''}
    </div>`).join('');
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
  if(ROLE!=='owner'){toast('Hanya owner');return;}
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
  const ok=confirm(
    'KONFIRMASI CLOSING\n\n'+
    'Bagian Syarvi: '+idr(owner)+' - '+(bhOwnerStatus==='ambil'?'Sudah diambil (kas -'+idr(owner)+')':'Belum diambil')+'\n'+
    'Fee Ilham: '+idr(mitra)+' - '+(bhIlhamStatus==='tunai'?'Bayar tunai':bhIlhamStatus==='kasbon'?'Potong kasbon Ilham -'+idr(pot):'Tunai '+idr(tunaiIlham)+' + Potong kasbon Ilham -'+idr(pot))+'\n'+
    'Cicilan Motor: '+idr(motor)+' - '+(bhMotorStatus==='bayar'?'Udah dibayar':'Belum dibayar')+'\n\n'+
    'Kas berkurang: '+idr(totalKasBerkurang)+'\n'+
    'Kas akhir: '+idr(ST.kas-totalKasBerkurang)+'\n'+
    'Sisa kasbon: '+idr(Math.max(0,kasbonAktif()-pot))+'\n\n'+
    'Lanjut simpan?'
  );
  if(!ok)return;
  const patch={};
  patch.kas=ST.kas-totalKasBerkurang;
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
  patch.laba_akum=ST.laba_akum+bhLaba;
  patch.week_omzet=0;patch.week_laba=0;
  const bhData={
    bh_laba:bhLaba,bh_owner:owner,bh_mitra:mitra,bh_motor:motor,bh_cad:cad,bh_pot:pot,
    bh_skema:lunas?'51/45/4':'55/35/10',
    bh_owner_status:bhOwnerStatus,bh_ilham_status:bhIlhamStatus,bh_motor_status:bhMotorStatus
  };
  const closingRow={omzet_week:ST.week_omzet,laba_week:ST.week_laba,tgl:today(),...bhData};
  const res=await sb('POST','closing',closingRow);
  if(res&&res.length)CLOSING.unshift(res[0]);else CLOSING.unshift(closingRow);
  await saveState(patch);
  await addJurnal('closing',`Closing: laba ${idr(bhLaba,true)} | kas -${idr(totalKasBerkurang,true)}`);
  setv('bh-input','');
  el('prev-bh').classList.remove('show');
  KASBON=await sb('GET','kasbon',null,'?order=created_at.desc')||[];
  toast('✅ Tutup Buku tersimpan!');renderAll();
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
  if(!CLOSING.length){e.innerHTML='<div class="empty">Belum ada closing</div>';return;}
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
  if(ROLE!=='owner'){toast('Hanya owner');return;}
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
  if(ROLE!=='owner'){toast('Hanya owner');return;}
  const kal=+v('sup-kal'),hkal=+v('sup-hkal')||270000,
    bayar=+v('sup-bayar')||0,dari=v('sup-dari'),tgl=v('sup-tgl');
  if(!kal){toast('Isi jumlah kaleng');return;}
  const total=kal*hkal,hutangBaru=total-bayar;
  if(bayar>0){
    if(dari==='kas'&&ST.kas<bayar){toast('Kas tidak cukup');return;}
    if(dari==='bank'&&ST.bank<bayar){toast('Saldo bank tidak cukup');return;}
  }
  const patch={stok_kal:ST.stok_kal+kal,hutang_sup:ST.hutang_sup+hutangBaru};
  if(bayar>0){if(dari==='kas')patch.kas=ST.kas-bayar;else patch.bank=ST.bank-bayar;}
  await saveState(patch);
  await addJurnal('kas',`Beli ${kal} kaleng | total ${idr(total,true)} | hutang baru ${idr(hutangBaru,true)}`,tgl);
  setv('sup-kal','');setv('sup-bayar','');
  toast(`✅ ${kal} kaleng dicatat!`);renderAll();
}

async function bayarSupplier(){
  if(ROLE!=='owner'){toast('Hanya owner');return;}
  const nom=+v('hs-nom'),dari=v('hs-dari'),tgl=v('hs-tgl');
  if(!nom){toast('Isi nominal');return;}
  const saldoAkun=dari==='kas'?ST.kas:ST.bank;
  const patch={hutang_sup:Math.max(0,ST.hutang_sup-nom)};
  if(saldoAkun>=nom){
    // Kas cukup - bayar normal
    if(dari==='kas')patch.kas=ST.kas-nom;else patch.bank=ST.bank-nom;
    await saveState(patch);
    await addJurnal('kas',`Bayar supplier ${idr(nom,true)} dari ${dari==='kas'?'Kas':'Bank'}`,tgl);
    setv('hs-nom','');
    toast('✅ Pembayaran supplier dicatat!');renderAll();
  } else {
    // Kas kurang - tawarkan tambal dari uang pribadi
    const kurang=nom-saldoAkun;
    const tambal=confirm(
      'Kas tidak cukup!\n\n'+
      'Mau bayar: '+idr(nom)+
      '\nKas tersedia: '+idr(saldoAkun)+
      '\nKekurangan: '+idr(kurang)+
      '\n\nTambal '+idr(kurang)+' dari uang pribadi lo?'+
      '\n(KBB akan catat utang ke owner sebesar '+idr(kurang)+')'
    );
    if(!tambal)return;
    // Kas habis, kekurangan dari kantong pribadi
    if(dari==='kas')patch.kas=0;else patch.bank=0;
    patch.utang_owner=(ST.utang_owner||0)+kurang;
    await saveState(patch);
    await addJurnal('kas',`Bayar supplier ${idr(nom,true)} | kas ${idr(saldoAkun,true)} + pribadi ${idr(kurang,true)}`,tgl);
    setv('hs-nom','');
    toast('✅ Supplier dibayar! KBB utang ke lo: '+idr(kurang));renderAll();
  }
}

async function simpanOps(){
  if(ROLE!=='owner'){toast('Hanya owner');return;}
  const nom=+v('op-nom'),ket=v('op-ket'),tgl=v('op-tgl'),jenis=v('op-jenis');
  if(!nom){toast('Isi nominal');return;}
  const patch={};
  if(ST.kas>=nom){
    patch.kas=ST.kas-nom;
    await saveState(patch);
    await addJurnal('kas',`${jenis}: ${ket||'-'} | ${idr(nom,true)}`,tgl);
    setv('op-nom','');setv('op-ket','');
    toast('✅ Pengeluaran dicatat!');renderAll();
  } else {
    const kurang=nom-ST.kas;
    const tambal=confirm(
      'Kas tidak cukup!\nKas: '+idr(ST.kas)+'\nKurang: '+idr(kurang)+
      '\n\nTambal dari uang pribadi lo?\n(KBB catat utang ke owner: '+idr(kurang)+')'
    );
    if(!tambal)return;
    patch.kas=0;
    patch.utang_owner=(ST.utang_owner||0)+kurang;
    await saveState(patch);
    await addJurnal('kas',`${jenis}: ${ket||'-'} | ${idr(nom,true)} (pribadi: ${idr(kurang,true)})`,tgl);
    setv('op-nom','');setv('op-ket','');
    toast('✅ Pengeluaran dicatat! KBB utang ke lo: '+idr(kurang));renderAll();
  }
}

// ─── PIUTANG OWNER ────────────────────────────────────────
async function ambilPiutangOwner(){
  if(ROLE!=='owner'){toast('Hanya owner');return;}
  const nom=+v('po-nom');
  if(!nom){toast('Isi nominal');return;}
  if(nom>(ST.utang_owner||0)){toast('Melebihi utang KBB ke lo: '+idr(ST.utang_owner));return;}
  if(ST.kas<nom){toast('Kas tidak cukup');return;}
  await saveState({
    kas:ST.kas-nom,
    utang_owner:Math.max(0,(ST.utang_owner||0)-nom)
  });
  await addJurnal('kas',`Owner ambil piutang ${idr(nom,true)} dari kas`);
  setv('po-nom','');
  toast('✅ Piutang owner diambil: '+idr(nom));renderAll();
}

// ─── KASBON ───────────────────────────────────────────────
async function simpanKasbon(){
  const nom=+v('kb-nom'),ket=v('kb-ket'),tgl=v('kb-tgl');
  if(!nom){toast('Isi nominal');return;}
  // Tambah ke kasbon aktif yang ada, atau buat baru kalau belum ada
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
  // Catat riwayat di jurnal
  await addJurnal('kas',`Kasbon Ilham: ${ket||'-'} ${idr(nom,true)}`,tgl);
  setv('kb-nom','');setv('kb-ket','');
  closeModal('modal-kasbon');
  toast('✅ Kasbon +'+idr(nom,true)+' | Total: '+idr(kasbonAktif()+nom));
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
  if(ROLE!=='owner'){toast('Hanya owner');return;}
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
