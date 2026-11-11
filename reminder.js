/* reminder.js v3 — Reminder USG: tanggal pemeriksaan satu kali untuk semua pasien, jenis USG pilihan,
   pesan WA otomatis + persiapan per jenis USG, pasien terkirim masuk ke tab Data Pasien (per tanggal & jenis). */
(function () {
  'use strict';
  var KEY = 'rekap-radiologi-reminder-usg-v1', TKEY = 'rekap-radiologi-reminder-usg-template-v2', PKEY = 'rekap-radiologi-reminder-usg-prep-v1';
  var MKEY = 'rekap-radiologi-master-types-v1';
  var BUILTIN = ['USG Abdomen', 'USG Obstetri', 'USG Ginjal/Traktus Urinarius', 'USG Tiroid', 'USG Mammae', 'USG Scrotum', 'USG Muskuloskeletal', 'USG Lainnya'];
  var SESI = { pagi: { label: 'Pagi', jam: '10.00', puasa: '05.00' }, sore: { label: 'Sore', jam: '16.30', puasa: '12.00' } };
  var DEFAULT_TPL =
    'Selamat {salam} {nama},\n' +
    'Kami dari Instalasi Radiologi RS Setia Mitra mengingatkan jadwal pemeriksaan USG Anda besok, {tanggal}, pukul {jam} WIB.\n\n' +
    '{persiapan}\n\n' +
    '{alur}\n\n' +
    'Jika berhalangan hadir, mohon informasikan kepada kami. Terima kasih.';
  // Persiapan bawaan per jenis USG. {puasa} = jam terakhir makan sesuai sesi. Bisa diubah di panel "Persiapan per jenis USG".
  var DEFAULT_PREP = {
    'USG Abdomen': 'Persiapan: puasa, makan terakhir pukul {puasa} WIB, boleh minum air putih. Mohon membawa air putih 1 ½ Liter dan jangan buang air kecil sebelum pemeriksaan.',
    'USG Obstetri': 'Persiapan: tidak ada persiapan khusus.',
    'USG Ginjal/Traktus Urinarius': 'Persiapan: tidak ada persiapan khusus. Mohon membawa air putih 1 ½ Liter dan jangan buang air kecil sebelum pemeriksaan.',
    'USG Tiroid': 'Persiapan: tidak ada persiapan khusus.',
    'USG Mammae': 'Persiapan: tidak ada persiapan khusus.',
    'USG Scrotum': 'Persiapan: tidak ada persiapan khusus.',
    'USG Muskuloskeletal': 'Persiapan: tidak ada persiapan khusus.',
    'USG Lainnya': 'Persiapan: tidak ada persiapan khusus.'
  };
  var NO_PREP = 'Persiapan: tidak ada persiapan khusus.';
  var ALUR = {
    umum: 'Untuk pendaftaran, silakan mendaftar terlebih dahulu di Pendaftaran, kemudian menuju Radiologi.',
    langsung: 'Untuk pendaftaran tidak perlu daftar online, saat datang bisa langsung menuju Radiologi.'
  };
  var MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var keyOf = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var obj = function (k) { return new Date(k + 'T12:00:00'); };
  var todayKey = function () { return keyOf(new Date()); };
  function addDays(k, n) { var d = obj(k); d.setDate(d.getDate() + n); return keyOf(d); }
  function longDate(k) { var d = obj(k); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function shortDate(k) { var d = obj(k); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function salam() { var h = new Date().getHours(); return h < 11 ? 'Pagi' : h < 15 ? 'Siang' : h < 18 ? 'Sore' : 'Malam'; }

  function loadJSON(k, fb) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function load() { var a = loadJSON(KEY, []); return Array.isArray(a) ? a : []; }
  function save(a) { return saveJSON(KEY, a); }
  function getTpl() { try { return localStorage.getItem(TKEY) || DEFAULT_TPL; } catch (e) { return DEFAULT_TPL; } }
  function setTpl(v) { try { localStorage.setItem(TKEY, v); } catch (e) {} }
  function getPrep() { var o = loadJSON(PKEY, {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  function prepOf(jenis) { var o = getPrep(); return o[jenis] != null ? o[jenis] : (DEFAULT_PREP[jenis] || NO_PREP); }
  // Jenis USG = bawaan + tambahan dari menu Master Pemeriksaan
  function jenisList() {
    var m = loadJSON(MKEY, {}), extra = m && Array.isArray(m.usg) ? m.usg.map(function (t) { return t && t.name; }).filter(Boolean) : [];
    return BUILTIN.concat(extra.filter(function (n) { return BUILTIN.indexOf(n) < 0; }));
  }

  function normPhone(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.indexOf('8') === 0) d = '62' + d;
    return /^62\d{8,13}$/.test(d) ? d : '';
  }
  function stateOf(p) { var t = todayKey(), h1 = addDays(p.tanggal, -1); return h1 === t ? 'siap' : h1 > t ? 'tunggu' : 'lewat'; }
  function sesiOf(p) { return SESI[p.sesi] || null; }
  function fill(p) {
    var s = sesiOf(p), prep = prepOf(p.jenis || '').replace(/\{puasa\}/g, s ? s.puasa : '(sesuai arahan petugas)');
    var out = getTpl()
      .replace(/\{salam\}/g, salam()).replace(/\{nama\}/g, p.nama).replace(/\{tanggal\}/g, longDate(p.tanggal))
      .replace(/\{jam\}/g, s ? s.jam : '-').replace(/\{jenis\}/g, p.jenis || 'USG')
      .replace(/\{persiapan\}/g, prep).replace(/\{alur\}/g, ALUR[p.alur] || ALUR.langsung);
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  var data = load(), tab = 'kirim', dpMonth = '';

  function shell() {
    $('reminderApp').innerHTML =
      '<div class="seg rm-tabs" id="rmTabs"><button type="button" data-t="kirim" class="on">Kirim Reminder</button><button type="button" data-t="data">Data Pasien</button></div>' +
      '<div id="rmPaneKirim">' +
        '<div id="rmBanner" class="rm-banner" role="status" aria-live="polite"></div>' +
        '<div id="rmQueue" class="rm-queue" hidden></div>' +
        '<form id="rmForm" class="rm-batch" autocomplete="off">' +
          '<div class="rm-batchhead"><h3>Input pasien</h3></div>' +
          '<div class="rm-shared">' +
            '<label>Tanggal pemeriksaan (semua pasien)<input id="rmDate" type="date" min="' + todayKey() + '"></label>' +
            '<label>Sesi<select id="rmSesi"><option value="">Pilih sesi</option><option value="pagi">Pagi · 10.00 WIB</option><option value="sore">Sore · 16.30 WIB</option></select></label>' +
            '<label>Pendaftaran<select id="rmAlur"><option value="langsung">BPJS / Asuransi (langsung ke Radiologi)</option><option value="umum">Umum (daftar dulu di Pendaftaran)</option></select></label>' +
          '</div>' +
          '<div class="rm-rowshead"><span>#</span><span>Nama pasien</span><span>No. WhatsApp</span><span>Jenis USG</span><span></span></div>' +
          '<div id="rmRows" class="rm-rows"></div>' +
          '<div class="rm-batchfoot"><button type="button" id="rmAdd" class="secondary">+ Tambah baris</button><button type="button" id="rmAdd5" class="secondary">+ 5 baris</button><button class="primary-action" type="submit">Simpan Semua</button></div>' +
        '</form>' +
        '<p id="rmMsg" class="muted rm-msg" role="status" aria-live="polite"></p>' +
        '<details class="rm-tpl"><summary>Isi pesan reminder &amp; persiapan per jenis USG</summary>' +
          '<p class="hint">Pesan terisi otomatis per pasien. Kode yang bisa dipakai: {salam} {nama} {tanggal} {jam} {jenis} {persiapan} {alur}.</p>' +
          '<textarea id="rmTpl" rows="9"></textarea>' +
          '<button type="button" id="rmTplReset" class="secondary">Kembalikan pesan bawaan</button>' +
          '<h4 class="rm-h4">Persiapan per jenis USG</h4><p class="hint">Gunakan {puasa} untuk jam terakhir makan (mengikuti sesi). Perubahan tersimpan otomatis.</p>' +
          '<div id="rmPrep" class="rm-prep"></div>' +
          '<button type="button" id="rmPrepReset" class="secondary">Kembalikan persiapan bawaan</button>' +
          '<h4 class="rm-h4">Pratinjau pesan</h4><pre id="rmPreview" class="rm-preview"></pre>' +
        '</details>' +
        '<div class="rm-listhead"><h3>Belum dikirim</h3></div><div id="rmList" class="rm-list"></div>' +
      '</div>' +
      '<div id="rmPaneData" hidden></div>';
    $('rmTpl').value = getTpl();
    $('rmPrep').innerHTML = jenisList().map(function (j, i) {
      return '<label>' + esc(j) + '<textarea rows="2" data-prep="' + esc(j) + '"></textarea></label>';
    }).join('');
    document.querySelectorAll('#rmPrep textarea').forEach(function (t) { t.value = prepOf(t.dataset.prep); });
    renderRows([]); preview();
  }

  function preview() {
    var j = jenisList()[0], p = { nama: 'Ibu Contoh', tanggal: addDays(todayKey(), 1), jenis: j, sesi: $('rmSesi') && $('rmSesi').value || 'sore', alur: $('rmAlur') && $('rmAlur').value || 'langsung' };
    var el = $('rmPreview'); if (el) el.textContent = fill(p);
  }

  function jenisOptions(sel) {
    return '<option value="">Pilih jenis</option>' + jenisList().map(function (j) { return '<option' + (j === sel ? ' selected' : '') + ' value="' + esc(j) + '">' + esc(j) + '</option>'; }).join('');
  }

  function render() {
    var t = todayKey(), tomorrow = addDays(t, 1);
    var pending = data.filter(function (p) { return p.status !== 'terkirim'; });
    var due = pending.filter(function (p) { return stateOf(p) === 'siap'; });
    var b = $('rmBanner');
    b.className = 'rm-banner' + (due.length ? ' is-due' : '');
    b.innerHTML = due.length
      ? '<div><strong>' + due.length + ' pasien perlu dikirimi reminder hari ini</strong><span>Pemeriksaan besok, ' + esc(longDate(tomorrow)) + '</span></div><button type="button" class="primary-action" data-act="queue">Kirim semua yang siap (' + due.length + ')</button>'
      : '<strong>Tidak ada reminder yang perlu dikirim hari ini</strong><span>Pasien dengan pemeriksaan besok (' + esc(shortDate(tomorrow)) + ') akan muncul di sini.</span>';
    var rows = pending.slice().sort(function (a, c) { return a.tanggal < c.tanggal ? -1 : a.tanggal > c.tanggal ? 1 : a.nama.localeCompare(c.nama); });
    $('rmList').innerHTML = rows.length ? rows.map(item).join('') : '<p class="empty-state">' + (data.length ? 'Semua pasien sudah dikirimi reminder. Lihat di tab Data Pasien.' : 'Belum ada pasien. Isi formulir di atas untuk mencatat pasien pertama.') + '</p>';
    renderData();
  }

  function item(p) {
    var st = stateOf(p), h1 = addDays(p.tanggal, -1);
    var chip = st === 'siap' ? '<span class="st rm-ready">Siap dikirim</span>'
      : st === 'tunggu' ? '<span class="st">Bisa dikirim ' + esc(shortDate(h1)) + '</span>'
      : '<span class="st is-bad">Terlewat</span>';
    var can = st === 'siap';
    var tip = can ? '' : ' disabled title="Hanya bisa dikirim H-1 (' + esc(longDate(h1)) + ')"';
    return '<article class="rm-item' + (can ? ' is-due' : '') + '">' +
      '<div class="rm-main"><strong>' + esc(p.nama) + '</strong><span>+' + esc(p.wa) + ' · ' + esc(p.jenis || 'Jenis belum dipilih') + '</span><small>Periksa: ' + esc(longDate(p.tanggal)) + (sesiOf(p) ? ' · ' + sesiOf(p).label : '') + '</small></div>' +
      '<div class="rm-side">' + chip + '<div class="rm-actions">' +
        '<button type="button" class="primary-action" data-act="send" data-id="' + esc(p.id) + '"' + tip + '>Kirim WA</button>' +
        '<button type="button" class="danger" data-act="del" data-id="' + esc(p.id) + '">Hapus</button>' +
      '</div></div></article>';
  }

  // ---- Tab Data Pasien: hanya yang sudah dikirim, dikelompokkan per tanggal pemeriksaan lalu jenis USG
  function renderData() {
    var host = $('rmPaneData'); if (!host) return;
    var sent = data.filter(function (p) { return p.status === 'terkirim'; });
    var months = {}; sent.forEach(function (p) { months[p.tanggal.slice(0, 7)] = 1; });
    var mlist = Object.keys(months).sort().reverse();
    if (!dpMonth || !months[dpMonth]) dpMonth = mlist[0] || '';
    var shown = sent.filter(function (p) { return p.tanggal.slice(0, 7) === dpMonth; });
    var byDate = {}; shown.forEach(function (p) { (byDate[p.tanggal] = byDate[p.tanggal] || []).push(p); });
    var html = '<div class="rm-listhead"><h3>Data pasien (sudah dikirim reminder)</h3>' +
      (mlist.length ? '<label class="rm-same">Bulan<select id="rmDpMonth">' + mlist.map(function (m) { var y = m.slice(0, 4), mo = Number(m.slice(5)); return '<option value="' + m + '"' + (m === dpMonth ? ' selected' : '') + '>' + MONTHS[mo - 1] + ' ' + y + '</option>'; }).join('') + '</select></label>' : '') + '</div>';
    if (!sent.length) html += '<p class="empty-state">Belum ada pasien yang dikirimi reminder. Pasien yang sudah dikirim WhatsApp otomatis masuk ke sini.</p>';
    else {
      html += '<p class="muted">' + shown.length + ' pasien pada bulan ini.</p>';
      html += Object.keys(byDate).sort().map(function (d) {
        var byJ = {}; byDate[d].forEach(function (p) { var j = p.jenis || 'Jenis belum dipilih'; (byJ[j] = byJ[j] || []).push(p); });
        return '<section class="rm-dp"><h4>' + esc(longDate(d)) + ' <small>' + byDate[d].length + ' pasien</small></h4>' +
          Object.keys(byJ).sort().map(function (j) {
            return '<div class="rm-dpj"><div class="rm-dpjh"><b>' + esc(j) + '</b><span>' + byJ[j].length + ' pasien</span></div><ul>' +
              byJ[j].sort(function (a, c) { return a.nama.localeCompare(c.nama); }).map(function (p) {
                return '<li><span><strong>' + esc(p.nama) + '</strong> · +' + esc(p.wa) + '</span><button type="button" class="danger" data-act="del" data-id="' + esc(p.id) + '">Hapus</button></li>';
              }).join('') + '</ul></div>';
          }).join('') + '</section>';
      }).join('');
    }
    host.innerHTML = html;
  }

  function say(text, bad) { var m = $('rmMsg'); m.textContent = text; m.classList.toggle('bad', !!bad); }

  var MINROWS = 10;
  function rowHTML(i, v) {
    return '<div class="rm-row' + (v.bad ? ' is-bad' : '') + '"><span class="rm-no">' + (i + 1) + '</span>' +
      '<input class="rn" type="text" maxlength="80" placeholder="Nama lengkap" aria-label="Nama pasien baris ' + (i + 1) + '" value="' + esc(v.n || '') + '">' +
      '<input class="rw" type="tel" inputmode="tel" placeholder="0812xxxxxxxx" aria-label="No. WhatsApp baris ' + (i + 1) + '" value="' + esc(v.w || '') + '">' +
      '<select class="rj" aria-label="Jenis USG baris ' + (i + 1) + '">' + jenisOptions(v.j || '') + '</select>' +
      '<button type="button" class="rm-x" data-rm aria-label="Hapus baris ' + (i + 1) + '">\u00d7</button></div>';
  }
  function renderRows(vals) {
    var list = vals.slice(); while (list.length < MINROWS) list.push({});
    $('rmRows').innerHTML = list.map(function (v, i) { return rowHTML(i, v); }).join('');
  }
  function readRows() {
    return Array.prototype.map.call(document.querySelectorAll('#rmRows .rm-row'), function (r) {
      return { n: r.querySelector('.rn').value, w: r.querySelector('.rw').value, j: r.querySelector('.rj').value };
    });
  }
  function addRows(n) {
    var vals = readRows(); for (var i = 0; i < n; i++) vals.push({});
    renderRows(vals);
    var inputs = document.querySelectorAll('#rmRows .rn'); inputs[inputs.length - n].focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    var tgl = $('rmDate').value, sesi = $('rmSesi').value, alur = $('rmAlur').value;
    var rows = readRows(), filled = rows.filter(function (r) { return r.n.trim() || r.w.trim() || r.j; });
    // Baris yang sama sekali kosong dibiarkan, tidak ditandai.
    if (!filled.length) return say('Belum ada data yang diisi.', true);
    if (!tgl) return say('Isi tanggal pemeriksaan dulu (berlaku untuk semua pasien).', true);
    if (tgl < todayKey()) return say('Tanggal pemeriksaan sudah lewat.', true);
    if (!sesi) return say('Pilih sesi pemeriksaan (pagi/sore) dulu.', true);
    var saved = 0, keep = [], errs = [];
    rows.forEach(function (r, i) {
      if (!r.n.trim() && !r.w.trim() && !r.j) return;
      var nama = r.n.trim(), wa = normPhone(r.w), problem = '';
      if (!nama) problem = 'nama kosong';
      else if (!wa) problem = 'No. WA tidak valid';
      else if (!r.j) problem = 'jenis USG belum dipilih';
      else if (data.some(function (p) { return p.wa === wa && p.tanggal === tgl && p.jenis === r.j; })) problem = 'sudah tercatat';
      if (problem) { keep.push({ n: r.n, w: r.w, j: r.j, bad: true }); errs.push('Baris ' + (i + 1) + ': ' + problem); return; }
      data.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nama: nama, wa: wa, jenis: r.j, tanggal: tgl, sesi: sesi, alur: alur, status: 'belum', dibuat: new Date().toISOString() });
      saved++;
    });
    if (saved && !save(data)) return say('Gagal menyimpan: ruang browser penuh.', true);
    renderRows(keep);
    say((saved ? saved + ' pasien tersimpan. ' : '') + (errs.length ? 'Perlu diperbaiki \u2192 ' + errs.join('; ') + '.' : ''), errs.length > 0);
    render();
  }

  function markSent(p) { p.status = 'terkirim'; p.dikirim = new Date().toISOString(); save(data); }
  function openWA(p) { window.open('https://wa.me/' + p.wa + '?text=' + encodeURIComponent(fill(p)), '_blank', 'noopener'); }

  var queue = [], qTotal = 0;
  function renderQueue() {
    var q = $('rmQueue');
    if (!queue.length) { q.hidden = true; q.innerHTML = ''; return; }
    var p = data.filter(function (x) { return x.id === queue[0]; })[0];
    q.hidden = false;
    q.innerHTML = '<div><strong>Antrean kirim ' + (qTotal - queue.length + 1) + ' dari ' + qTotal + '</strong><span>Berikutnya: ' + esc(p ? p.nama : '') + '</span></div>' +
      '<div class="rm-actions"><button type="button" class="primary-action" data-act="next">Buka WhatsApp \u2192 ' + esc(p ? p.nama : '') + '</button><button type="button" class="danger" data-act="cancel">Batal</button></div>';
  }
  function startQueue() {
    queue = data.filter(function (p) { return stateOf(p) === 'siap' && p.status !== 'terkirim'; })
      .sort(function (a, c) { return a.nama.localeCompare(c.nama); }).map(function (p) { return p.id; });
    qTotal = queue.length; renderQueue();
  }
  function sendNext() {
    var id = queue.shift(), p = data.filter(function (x) { return x.id === id; })[0];
    if (p && stateOf(p) === 'siap') { openWA(p); markSent(p); }
    if (!queue.length) say('Antrean selesai. Pastikan tombol kirim sudah ditekan di WhatsApp untuk setiap pasien. Pasien yang terkirim ada di tab Data Pasien.');
    renderQueue(); render();
  }

  function onListClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var p = data.filter(function (x) { return x.id === btn.dataset.id; })[0];
    if (!p) return;
    if (btn.dataset.act === 'del') {
      if (!confirm('Hapus ' + p.nama + ' dari daftar?')) return;
      data = data.filter(function (x) { return x !== p; }); save(data); render(); return;
    }
    if (stateOf(p) !== 'siap') return say('Reminder hanya bisa dikirim pada H-1.', true);
    openWA(p); markSent(p);
    say('WhatsApp dibuka untuk ' + p.nama + '. Tekan tombol kirim di WhatsApp. Data pasien dipindahkan ke tab Data Pasien.');
    render();
  }

  function setTab(t) {
    tab = t;
    $('rmPaneKirim').hidden = t !== 'kirim'; $('rmPaneData').hidden = t !== 'data';
    document.querySelectorAll('#rmTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
  }

  function init() {
    if (!$('reminderApp')) return;
    shell(); render();
    $('rmForm').addEventListener('submit', onSubmit);
    $('rmAdd').addEventListener('click', function () { addRows(1); });
    $('rmAdd5').addEventListener('click', function () { addRows(5); });
    $('rmRows').addEventListener('click', function (e) {
      var x = e.target.closest('[data-rm]'); if (!x) return;
      var row = x.closest('.rm-row'), rows = document.querySelectorAll('#rmRows .rm-row');
      if (rows.length > MINROWS) { var vals = readRows(); vals.splice(Array.prototype.indexOf.call(rows, row), 1); renderRows(vals); }
      else { row.querySelectorAll('input').forEach(function (i) { i.value = ''; }); row.querySelector('select').value = ''; row.classList.remove('is-bad'); }
    });
    $('rmTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) setTab(b.dataset.t); });
    $('rmBanner').addEventListener('click', function (e) { if (e.target.closest('[data-act="queue"]')) startQueue(); });
    $('rmQueue').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'next') sendNext(); else { queue = []; renderQueue(); }
    });
    $('rmList').addEventListener('click', onListClick);
    $('rmPaneData').addEventListener('click', onListClick);
    $('rmPaneData').addEventListener('change', function (e) { if (e.target.id === 'rmDpMonth') { dpMonth = e.target.value; renderData(); } });
    $('rmTpl').addEventListener('input', function (e) { setTpl(e.target.value); preview(); });
    $('rmTplReset').addEventListener('click', function () { $('rmTpl').value = DEFAULT_TPL; setTpl(DEFAULT_TPL); preview(); });
    $('rmPrep').addEventListener('input', function (e) {
      var j = e.target.dataset.prep; if (!j) return;
      var o = getPrep(); o[j] = e.target.value; saveJSON(PKEY, o); preview();
    });
    $('rmPrepReset').addEventListener('click', function () {
      try { localStorage.removeItem(PKEY); } catch (e) {}
      document.querySelectorAll('#rmPrep textarea').forEach(function (t) { t.value = prepOf(t.dataset.prep); }); preview();
    });
    $('rmSesi').addEventListener('change', preview); $('rmAlur').addEventListener('change', preview);
    // segarkan status H-1 dan daftar jenis USG setiap modul dibuka
    var v = $('v-reminder');
    if (v) new MutationObserver(function () {
      if (v.hidden) return;
      var vals = readRows(); renderRows(vals.filter(function (r) { return r.n || r.w || r.j; })); render();
    }).observe(v, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
