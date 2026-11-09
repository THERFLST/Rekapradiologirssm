const STORAGE_KEY = 'rekap-radiologi-v1';
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const ORIGINS = [{key:'umum',label:'Umum'},{key:'spesialis',label:'Poli Spesialis'},{key:'ruangan',label:'Ruangan'},{key:'luarRs',label:'Luar RS'}];
const PAYERS = [{key:'bpjs',label:'BPJS'},{key:'umum',label:'Umum'},{key:'asuransi',label:'Asuransi'},{key:'naker',label:'Naker (keterangan)'}];
const EXAMS = [
  {key:'thoraxPa',label:'Thorax PA',group:'Non Kontras'},{key:'thoraxPaLat',label:'Thorax PA & Lat',group:'Non Kontras'},
  {key:'extremitas',label:'Extremitas',group:'Non Kontras'},{key:'extremitasBilateral',label:'Extremitas Bilateral',group:'Non Kontras'},
  {key:'columnaVertebralis',label:'Columna Vertebralis',group:'Non Kontras'},{key:'columnaVert4Posisi',label:'Columna Vert 4 Posisi',group:'Non Kontras'},
  {key:'cranium',label:'Cranium',group:'Non Kontras'},{key:'sinus',label:'Sinus',group:'Non Kontras'},
  {key:'bnoAbdomen',label:'BNO/Abdomen',group:'Non Kontras'},{key:'abdomen3Posisi',label:'Abdomen 3 Posisi',group:'Non Kontras'},
  {key:'pelvis',label:'Pelvis',group:'Non Kontras'},{key:'pelvis2Posisi',label:'Pelvis 2 Posisi',group:'Non Kontras'},
  {key:'omdOesophagografi',label:'OMD/Oesophagografi',group:'Kontras'},{key:'md',label:'MD',group:'Kontras'},
  {key:'arthrografi',label:'Arthrografi',group:'Kontras'},{key:'cholecystografi',label:'Cholecystografi',group:'Kontras'},
  {key:'urethrocystografi',label:'Urethrocystografi',group:'Kontras'},{key:'hsg',label:'HSG',group:'Kontras'},
  {key:'colonInloop',label:'Colon Inloop (B. Enema)',group:'Kontras'},{key:'bnoIvp',label:'BNO-IVP',group:'Kontras'},
  {key:'rpg',label:'RPG',group:'Kontras'},{key:'corAnalisa',label:'COR Analisa',group:'Kontras'},
  {key:'appendicogram',label:'Appendicogram',group:'Kontras'}
];
const $ = (id) => document.getElementById(id);
const now = new Date();
const state = {year:now.getFullYear(), month:now.getMonth(), date:formatDate(now), data:loadData()};

function loadData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}}}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.data)); $('saveStatus').textContent='Tersimpan otomatis';}catch{$('saveStatus').textContent='Gagal menyimpan';}}
function monthKey(){return `${state.year}-${String(state.month+1).padStart(2,'0')}`}
function dateKey(day){return `${monthKey()}-${String(day).padStart(2,'0')}`}
function formatDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function daysInMonth(){return new Date(state.year,state.month+1,0).getDate()}
function emptyDay(){return {source:{},payer:{},exams:{}}}
function dayData(date=state.date){return state.data[date]||emptyDay()}
function num(value){if(value===''||value===null||value===undefined)return 0; const n=Number(value);return Number.isFinite(n)?n:0}
function fmt(value){return value===0?'-':Number(value).toLocaleString('id-ID')}
function percent(value,total){return total?`${(value/total*100).toFixed(1).replace('.',',')}%`:'0,0%'}
function escapeHtml(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function setupPeriod(){
  $('monthSelect').innerHTML=MONTHS.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
  const y=now.getFullYear(); $('yearSelect').innerHTML=Array.from({length:11},(_,i)=>y-5+i).map(v=>`<option value="${v}">${v}</option>`).join('');
  $('monthSelect').value=state.month; $('yearSelect').value=state.year;
  $('monthSelect').addEventListener('change',()=>{state.month=Number($('monthSelect').value); if(!dateInPeriod(state.date))state.date=dateKey(1); renderAll();});
  $('yearSelect').addEventListener('change',()=>{state.year=Number($('yearSelect').value); if(!dateInPeriod(state.date))state.date=dateKey(1); renderAll();});
  $('dateSelect').addEventListener('change',()=>{if(!$('dateSelect').value)return; const d=new Date(`${$('dateSelect').value}T12:00:00`);state.year=d.getFullYear();state.month=d.getMonth();$('yearSelect').value=state.year;$('monthSelect').value=state.month;state.date=$('dateSelect').value;renderAll();});
  $('prevDay').addEventListener('click',()=>shiftDate(-1)); $('nextDay').addEventListener('click',()=>shiftDate(1));
  $('clearDay').addEventListener('click',()=>{if(!confirm('Kosongkan semua angka untuk tanggal ini?'))return; delete state.data[state.date];persist();renderAll();});
}
function dateInPeriod(value){const d=new Date(`${value}T12:00:00`);return d.getFullYear()===state.year&&d.getMonth()===state.month}
function shiftDate(amount){const d=new Date(`${state.date}T12:00:00`);d.setDate(d.getDate()+amount);state.date=formatDate(d);state.year=d.getFullYear();state.month=d.getMonth();$('yearSelect').value=state.year;$('monthSelect').value=state.month;renderAll();}
function renderFields(){
  $('originFields').innerHTML=ORIGINS.map(x=>fieldMarkup('source',x.key,x.label,dayData().source?.[x.key])).join('');
  $('payerFields').innerHTML=PAYERS.map(x=>fieldMarkup('payer',x.key,x.label,dayData().payer?.[x.key])).join('');
  $('examFields').innerHTML=['Non Kontras','Kontras'].map(group=>`<div class="exam-group"><h4>${group}</h4><div class="exam-grid">${EXAMS.filter(x=>x.group===group).map(x=>`<div class="exam-row"><div class="exam-name">${escapeHtml(x.label)}</div>${examField(x.key,'pasien','Pasien')}${examField(x.key,'ekspose','Ekspose')}</div>`).join('')}</div></div>`).join('');
  document.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',handleInput));
  document.querySelectorAll('[data-exam]').forEach(input=>input.addEventListener('input',handleInput));
}
function fieldMarkup(type,key,label,value){return `<label class="number-field"><span>${escapeHtml(label)}</span><input type="number" min="0" step="1" inputmode="numeric" data-field="${type}" data-key="${key}" value="${value??''}" placeholder="0"></label>`}
function examField(key,kind,label){return `<label class="exam-number"><span>${label}</span><input aria-label="${escapeHtml(key)} ${label}" type="number" min="0" step="1" inputmode="numeric" data-exam="${key}" data-kind="${kind}" value="${dayData().exams?.[key]?.[kind]??''}" placeholder="0"></label>`}
function handleInput(event){
  const input=event.currentTarget; const raw=input.value;
  if(raw!==''&&(Number(raw)<0||!Number.isInteger(Number(raw))))input.setCustomValidity('Masukkan bilangan bulat nol atau lebih.'); else input.setCustomValidity('');
  if(!input.checkValidity()){input.reportValidity();return;}
  const record=state.data[state.date]||(state.data[state.date]=emptyDay());
  if(input.dataset.field){const group=input.dataset.field,key=input.dataset.key;record[group][key]=raw===''?'':Number(raw);}
  else {const exam=input.dataset.exam,kind=input.dataset.kind;record.exams[exam]=record.exams[exam]||{};record.exams[exam][kind]=raw===''?'':Number(raw);}
  $('saveStatus').textContent='Menyimpan…';persist();renderDailyTotals();renderChecks();renderMonthlySummary();
}
function validation(record){const errors=[];const origin=ORIGINS.reduce((s,x)=>s+num(record.source?.[x.key]),0);const payer=PAYERS.filter(x=>x.key!=='naker').reduce((s,x)=>s+num(record.payer?.[x.key]),0);
  if(origin!==payer)errors.push(`Asal pasien ${origin} tidak sama dengan penjamin ${payer}.`);
  for(const exam of EXAMS){const patient=num(record.exams?.[exam.key]?.pasien),expose=num(record.exams?.[exam.key]?.ekspose);if(expose<patient)errors.push(`Ekspose ${exam.label} (${expose}) lebih kecil dari pasien (${patient}).`);}
  return errors;
}
function totals(record){return {visits:ORIGINS.reduce((s,x)=>s+num(record.source?.[x.key]),0),exams:EXAMS.reduce((s,x)=>s+num(record.exams?.[x.key]?.pasien),0),expose:EXAMS.reduce((s,x)=>s+num(record.exams?.[x.key]?.ekspose),0)}}
function renderDailyTotals(){const t=totals(dayData()),errors=validation(dayData());$('dayVisits').textContent=fmt(t.visits);$('dayExams').textContent=fmt(t.exams);$('dayExpose').textContent=fmt(t.expose);$('dayStatus').textContent=errors.length?'Perlu dicek':'OK';$('dayStatus').className=`status-text ${errors.length?'error-text':'ok-text'}`;}
function renderChecks(){const issues=[];for(let day=1;day<=daysInMonth();day++){const key=dateKey(day),record=state.data[key]||emptyDay(),errs=validation(record);if(errs.length)issues.push({day,errs});}
  $('issueCount').textContent=`${issues.length} ${issues.length===1?'masalah':'masalah'}`;
  $('dailyChecks').innerHTML=issues.length?issues.map(x=>`<button class="check-item" type="button" data-goto="${dateKey(x.day)}"><span class="check-day">${x.day} ${MONTHS[state.month]}</span><span>${x.errs.map(escapeHtml).join(' ')}</span><span class="check-arrow">›</span></button>`).join(''):'<p class="empty-state"><span class="check-ok">✓</span> Tidak ada masalah validasi pada bulan ini.</p>';
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{state.date=b.dataset.goto;renderAll();$('entry-panel').scrollIntoView?.({behavior:'smooth'});}));
}
function renderMonthlySummary(){const totalsByOrigin=Object.fromEntries(ORIGINS.map(x=>[x.key,0])), totalsByPayer=Object.fromEntries(PAYERS.map(x=>[x.key,0])), exams=Object.fromEntries(EXAMS.map(x=>[x.key,{pasien:0,ekspose:0}]));let visits=0,examTotal=0,exposeTotal=0;
  for(let d=1;d<=daysInMonth();d++){const r=state.data[dateKey(d)]||emptyDay(),t=totals(r);visits+=t.visits;examTotal+=t.exams;exposeTotal+=t.expose;ORIGINS.forEach(x=>totalsByOrigin[x.key]+=num(r.source?.[x.key]));PAYERS.forEach(x=>totalsByPayer[x.key]+=num(r.payer?.[x.key]));EXAMS.forEach(x=>{exams[x.key].pasien+=num(r.exams?.[x.key]?.pasien);exams[x.key].ekspose+=num(r.exams?.[x.key]?.ekspose);});}
  $('totalVisits').textContent=visits.toLocaleString('id-ID');$('totalExams').textContent=examTotal.toLocaleString('id-ID');$('totalExpose').textContent=exposeTotal.toLocaleString('id-ID');
  $('originSummary').innerHTML=`<div class="summary-lines">${ORIGINS.map(x=>summaryLine(x.label,totalsByOrigin[x.key],percent(totalsByOrigin[x.key],visits))).join('')}<div class="summary-line total-line"><span>Total</span><strong>${fmt(visits)}</strong></div></div>`;
  const payerTotal=PAYERS.filter(x=>x.key!=='naker').reduce((s,x)=>s+totalsByPayer[x.key],0);
  $('payerSummary').innerHTML=`<div class="summary-lines">${PAYERS.map(x=>summaryLine(x.label,totalsByPayer[x.key],x.key==='naker'?'Keterangan':percent(totalsByPayer[x.key],payerTotal))).join('')}<div class="summary-line total-line"><span>Total penjamin (tanpa Naker)</span><strong>${fmt(payerTotal)}</strong></div></div>`;
  let grandPatient=0,grandExpose=0;const rows=['Non Kontras','Kontras'].map(group=>{let groupP=0,groupE=0;const line=EXAMS.filter(x=>x.group===group).map(x=>{const t=exams[x.key];groupP+=t.pasien;groupE+=t.ekspose;return `<tr><td>${escapeHtml(x.label)}</td><td>${fmt(t.pasien)}</td><td>${fmt(t.ekspose)}</td></tr>`;}).join('');grandPatient+=groupP;grandExpose+=groupE;return `<tr class="subtotal"><td>Subtotal ${group}</td><td>${fmt(groupP)}</td><td>${fmt(groupE)}</td></tr>${line}`;}).join('');
  $('examSummary').innerHTML=`${rows}<tr class="grand-total"><td>Grand total</td><td>${fmt(grandPatient)}</td><td>${fmt(grandExpose)}</td></tr>`;
}
function summaryLine(label,value,pct){return `<div class="summary-line"><span>${escapeHtml(label)}</span><strong>${fmt(value)} <small>${pct}</small></strong></div>`}
function renderAll(){ $('dateSelect').value=state.date;$('dateCaption').textContent=`${DAYS[new Date(`${state.date}T12:00:00`).getDay()]} · ${new Date(`${state.date}T12:00:00`).getDate()} ${MONTHS[state.month]} ${state.year}`;$('dateCaption').classList.toggle('sunday',new Date(`${state.date}T12:00:00`).getDay()===0);renderFields();renderDailyTotals();renderChecks();renderMonthlySummary(); }
setupPeriod();renderAll();
