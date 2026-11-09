(() => {
  'use strict';
  const KEY='rekap-radiologi-public-demo-v2';
  const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const ORIGINS=[['umum','Umum'],['spesialis','Poli Spesialis'],['ruangan','Ruangan'],['luarRs','Luar RS']];
  const PAYERS=[['bpjs','BPJS'],['umum','Umum'],['asuransi','Asuransi'],['naker','Naker (keterangan)']];
  const EXAMS=[['thoraxPa','Thorax PA','Non Kontras'],['thoraxPaLat','Thorax PA & Lat','Non Kontras'],['extremitas','Extremitas','Non Kontras'],['extremitasBilateral','Extremitas Bilateral','Non Kontras'],['columnaVertebralis','Columna Vertebralis','Non Kontras'],['columnaVert4Posisi','Columna Vert 4 Posisi','Non Kontras'],['cranium','Cranium','Non Kontras'],['sinus','Sinus','Non Kontras'],['bnoAbdomen','BNO/Abdomen','Non Kontras'],['abdomen3Posisi','Abdomen 3 Posisi','Non Kontras'],['pelvis','Pelvis','Non Kontras'],['pelvis2Posisi','Pelvis 2 Posisi','Non Kontras'],['omd','OMD/Oesophagografi','Non Kontras'],['md','MD','Non Kontras'],['arthrografi','Arthrografi','Kontras'],['cholecystografi','Cholecystografi','Kontras'],['urethrocystografi','Urethrocystografi','Kontras'],['hsg','HSG','Kontras'],['colonInloop','Colon Inloop (B. Enema)','Kontras'],['bnoIvp','BNO-IVP','Kontras'],['rpg','RPG','Kontras'],['corAnalisa','COR Analisa','Kontras'],['appendicogram','Appendicogram','Kontras']];
  const $=id=>document.getElementById(id), today=new Date(), pad=n=>String(n).padStart(2,'0');
  const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dateObj=k=>new Date(`${k}T12:00:00`);
  const short=k=>{const d=dateObj(k);return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`};
  const longDate=k=>{const d=dateObj(k);return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`};
  const S={view:'isi',date:keyOf(today),rek:{mode:'harian',ref:keyOf(today)},exp:{mode:'harian',ref:keyOf(today)} };
  const state={data:load()};
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state.data));$('saved').textContent='Tersimpan otomatis di browser ini.'}catch{$('saved').textContent='Gagal menyimpan: ruang browser penuh.'}}
  function record(key=S.date){return state.data[key]||{source:{},payer:{},exams:{}}}
  function value(v){if(v===''||v==null)return 0;const n=Number(v);return Number.isFinite(n)?n:0}
  function fmt(n){return n===0?'-':Number(n).toLocaleString('id-ID')}
  function total(r){return {visits:ORIGINS.reduce((s,[k])=>s+value(r.source[k]),0),exams:EXAMS.reduce((s,[k])=>s+value(r.exams[k]?.patients),0),exposure:EXAMS.reduce((s,[k])=>s+value(r.exams[k]?.exposures),0)}}
  function payerTotal(r){return PAYERS.filter(([k])=>k!=='naker').reduce((s,[k])=>s+value(r.payer[k]),0)}
  function validate(r){const errs=[];if(total(r).visits!==payerTotal(r))errs.push('Total asal pasien harus sama dengan BPJS + Umum + Asuransi.');for(const v of [...Object.values(r.source),...Object.values(r.payer),...EXAMS.flatMap(([k])=>[r.exams[k]?.patients,r.exams[k]?.exposures])]){if(v!==''&&v!=null&&(!Number.isInteger(Number(v))||Number(v)<0)){errs.push('Semua angka harus bilangan bulat non-negatif.');break}}return errs}
  function filled(r){return [...Object.values(r.source),...Object.values(r.payer),...EXAMS.flatMap(([k])=>[r.exams[k]?.patients,r.exams[k]?.exposures])].some(v=>v!==''&&v!=null)}
  function field(label,group,k,v){return `<label>${label}<input type="number" min="0" step="1" inputmode="numeric" value="${v??''}" data-group="${group}" data-key="${k}"></label>`}

  /* ---------- Menu 1: Isi Data ---------- */
  function renderFields(){const r=record();
    $('origins').innerHTML=ORIGINS.map(([k,l])=>field(l,'source',k,r.source[k])).join('');
    $('payers').innerHTML=PAYERS.map(([k,l])=>field(l,'payer',k,r.payer[k])).join('');
    $('exams').innerHTML=['Non Kontras','Kontras'].map(g=>`<h4>${g}</h4><div class="exam-grid">${EXAMS.filter(x=>x[2]===g).map(([k,l])=>`<div class="exam-row"><strong>${l}</strong><label>Pasien<input type="number" min="0" step="1" value="${r.exams[k]?.patients ?? ''}" data-exam="${k}" data-kind="patients"></label><label>Ekspose<input type="number" min="0" step="1" value="${r.exams[k]?.exposures ?? ''}" data-exam="${k}" data-kind="exposures"></label></div>`).join('')}</div>`).join('');
    document.querySelectorAll('#origins input,#payers input,#exams input').forEach(el=>el.addEventListener('input',onInput));
  }
  function updateDay(){const r=record(),t=total(r),errs=validate(r),d=dateObj(S.date);
    $('date').value=S.date;$('caption').textContent=longDate(S.date);$('caption').classList.toggle('sunday',d.getDay()===0);
    $('dayVisits').textContent=fmt(t.visits);$('dayExams').textContent=fmt(t.exams);$('dayExposure').textContent=fmt(t.exposure);
    $('dayStatus').textContent=errs.length?'Perlu dicek':'OK';$('dayStatus').className=errs.length?'bad':'good';
    $('errors').innerHTML=errs.length?`<ul>${errs.map(e=>`<li>${e}</li>`).join('')}</ul>`:'Data harian valid.'}
  function renderIsi(){renderFields();updateDay()}
  function onInput(e){const el=e.target;
    if(el.value!==''&&(!Number.isInteger(Number(el.value))||Number(el.value)<0)){el.setCustomValidity('Masukkan bilangan bulat nol atau lebih.');el.reportValidity();return}
    el.setCustomValidity('');const r=record(),v=el.value===''?'':Number(el.value);
    if(el.dataset.group)r[el.dataset.group][el.dataset.key]=v;else{r.exams[el.dataset.exam]||={};r.exams[el.dataset.exam][el.dataset.kind]=v}
    state.data[S.date]=r;save();updateDay()}
  function shift(n){const d=dateObj(S.date);d.setDate(d.getDate()+n);S.date=keyOf(d);renderIsi()}

  /* ---------- Periode & agregasi ---------- */
  function range(mode,ref){
    if(mode==='harian')return {keys:[ref],label:longDate(ref)};
    if(mode==='mingguan'){const d=dateObj(ref);d.setDate(d.getDate()-(d.getDay()+6)%7);const keys=[];for(let i=0;i<7;i++){keys.push(keyOf(d));d.setDate(d.getDate()+1)}return {keys,label:`${short(keys[0])} - ${short(keys[keys.length-1])}`}};
    const [y,m]=ref.slice(0,7).split('-').map(Number),n=new Date(y,m,0).getDate();
    return {keys:Array.from({length:n},(_,i)=>`${y}-${pad(m)}-${pad(i+1)}`),label:`${MONTHS[m-1]} ${y}`}}
  function agg(keys){
    const o=Object.fromEntries(ORIGINS.map(([k])=>[k,0])),p=Object.fromEntries(PAYERS.map(([k])=>[k,0])),e=Object.fromEntries(EXAMS.map(([k])=>[k,{p:0,x:0}]));
    let v=0,n=0,x=0;const rows=[];
    keys.forEach(k=>{const r=record(k),t=total(r),errs=validate(r),has=filled(r);v+=t.visits;n+=t.exams;x+=t.exposure;
      ORIGINS.forEach(([a])=>o[a]+=value(r.source[a]));PAYERS.forEach(([a])=>p[a]+=value(r.payer[a]));
      EXAMS.forEach(([a])=>{e[a].p+=value(r.exams[a]?.patients);e[a].x+=value(r.exams[a]?.exposures)});
      rows.push({k,t,errs,bad:has&&errs.length>0})});
    return {v,n,x,o,p,e,rows}}
  function line(label,n,all){return `<div class="summary-line"><span>${label}</span><strong>${fmt(n)} <small>${all?((n*100/all).toFixed(1).replace('.',',')+'%'):'0,0%'}</small></strong></div>`}
  function reportHTML(keys){
    const a=agg(keys),pt=PAYERS.filter(([k])=>k!=='naker').reduce((s,[k])=>s+a.p[k],0);
    let np=0,ne=0,cp=0,ce=0;
    const exRows=EXAMS.map(([k,l,g])=>{const s=a.e[k];if(g==='Non Kontras'){np+=s.p;ne+=s.x}else{cp+=s.p;ce+=s.x};return `<tr><td>${l}</td><td>${g}</td><td>${fmt(s.p)}</td><td>${fmt(s.x)}</td></tr>`}).join('');
    const daily=keys.length>1?`<div class="panel"><div class="section-title"><h2>Per hari</h2></div><div class="scroll"><table><thead><tr><th>Tanggal</th><th>Hari</th><th>Kunjungan</th><th>Pemeriksaan</th><th>Eksposur</th></tr></thead><tbody>${keys.map(k=>{const r=record(k),t=total(r);return `<tr><td>${short(k)}</td><td>${DAYS[dateObj(k).getDay()]}</td><td>${fmt(t.visits)}</td><td>${fmt(t.exams)}</td><td>${fmt(t.exposure)}</td></tr>`}).join('')}</tbody></table></div></div>`:'';
    const bad=a.rows.filter(r=>r.bad),issues=bad.length?`<div class="panel"><div class="section-title"><h2>Pengecekan</h2></div><div class="issues"><ul>${bad.map(r=>`<li><strong>${short(r.k)}:</strong> ${r.errs.join('; ')}</li>`).join('')}</ul></div></div>`:'';
    return `<section class="cards"><article><span>Kunjungan</span><strong>${fmt(a.v)}</strong></article><article><span>Pemeriksaan</span><strong>${fmt(a.n)}</strong></article><article><span>Eksposur</span><strong>${fmt(a.x)}</strong></article></section>
    <div class="panel"><div class="summary-grid"><article><h3>Asal pasien</h3>${ORIGINS.map(([k,l])=>line(l,a.o[k],a.v)).join('')+line('Total asal pasien',a.v,a.v)}</article><article><h3>Penjamin</h3>${PAYERS.filter(([k])=>k!=='naker').map(([k,l])=>line(l,a.p[k],pt)).join('')+line('Total penjamin',pt,pt)}</article></div></div>
    <div class="panel"><div class="section-title"><h2>Jenis pemeriksaan</h2></div><div class="scroll"><table><thead><tr><th>Jenis</th><th>Kelompok</th><th>Pasien</th><th>Ekspose</th></tr></thead><tbody>${exRows}</tbody></table></div></div>
    ${daily}${issues}`;
  }

  /* ---------- Kontrol periode ---------- */
  function controls(el,st,cb){
    const m=st.mode==='bulanan',lbl=m?'Bulan':st.mode==='mingguan'?'Tanggal dalam minggu':'Tanggal';
    el.innerHTML=`<div class="seg">${['harian','mingguan','bulanan'].map(x=>`<button type="button" class="${x===st.mode?'on':''}" data-mode="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><label>${lbl}<input type="${m?'month':'date'}" value="${st.ref}"></label>`;
    el.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{const n=b.dataset.mode;if(n==='bulanan')st.ref=st.ref.slice(0,7);else if(st.ref.length===7)st.ref+='-01';st.mode=n;cb()});
    el.querySelector('input').onchange=e=>{if(e.target.value){st.ref=e.target.value.length===7&&st.mode!=='bulanan'?e.target.value+'-01':e.target.value;cb()}}}
  function renderRekap(){controls($('rekapCtl'),S.rek,renderRekap);$('rekapOut').innerHTML=reportHTML(range(S.rek.mode,S.rek.ref).keys)}

  /* ---------- Menu 3: Export ---------- */
  function renderExport(){controls($('expCtl'),S.exp,renderExport);const r=range(S.exp.mode,S.exp.ref),a=agg(r.keys);$('expInfo').textContent=`Periode ${S.exp.mode}: ${r.label} · Kunjungan ${fmt(a.v)} · Pemeriksaan ${fmt(a.n)} · Ekspose ${fmt(a.x)}`}
  function exportExcel(){if(!window.XLSX){alert('Excel belum termuat. Periksa koneksi internet.');return}
    const r=range(S.exp.mode,S.exp.ref),a=agg(r.keys);
    const rows=[['Rekap Pasien Radiologi · RS Setia Mitra'],['Periode',`${S.exp.mode} · ${r.label}`],[],['Tanggal','Hari','Kunjungan','Pemeriksaan','Ekspose',...ORIGINS.map(x=>`Asal ${x[1]}`),...PAYERS.map(x=>`Penjamin ${x[1]}`)]];
    r.keys.forEach(k=>{const rec=record(k),t=total(rec);rows.push([short(k),DAYS[dateObj(k).getDay()],t.visits,t.exams,t.exposure,...ORIGINS.map(([c])=>value(rec.source[c])),...PAYERS.map(([c])=>value(rec.payer[c]))])});
    rows.push(['Total','',a.v,a.n,a.x,...ORIGINS.map(([c])=>a.o[c]),...PAYERS.map(([c])=>a.p[c])]);
    const ex=[['Jenis Pemeriksaan','Kelompok','Pasien','Ekspose'],...EXAMS.map(([k,l,g])=>[l,g,a.e[k].p,a.e[k].x]),['Grand total','',a.n,a.x]];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Rekap');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(ex),'Pemeriksaan');
    XLSX.writeFile(wb,`rekap-radiologi-${S.exp.mode}-${r.keys[0]}.xlsx`)}
  function exportPdf(){const r=range(S.exp.mode,S.exp.ref);$('printArea').innerHTML=`<div class="rpt-head"><p class="eyebrow">Instalasi Radiologi · RS Setia Mitra</p><h1>Rekap Pasien Radiologi</h1><p class="muted">Periode ${S.exp.mode}: ${r.label}</p></div><div class="panel">${reportHTML(r.keys)}</div>`;window.print()}

  /* ---------- Navigasi ---------- */
  function show(v){if(!['isi','rekap','total','export'].includes(v))v='isi';S.view=v;
    document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
    if(v==='isi')renderIsi();if(v==='rekap')renderRekap();if(v==='export')renderExport();
    history.replaceState(null,'','#'+v);window.scrollTo({top:0})}
  document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
  $('date').addEventListener('change',e=>{if(e.target.value){S.date=e.target.value;renderIsi()}});
  $('prev').addEventListener('click',()=>shift(-1));$('next').addEventListener('click',()=>shift(1));
  $('clear').addEventListener('click',()=>{if(!filled(record()))return;if(confirm(`Kosongkan data tanggal ${S.date}?`)){delete state.data[S.date];save();renderIsi()}});
  $('xls').addEventListener('click',exportExcel);$('pdf').addEventListener('click',exportPdf);
  show(location.hash.slice(1));
})();
