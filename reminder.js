/* reminder.js v5 — Reminder USG: tanggal pemeriksaan satu kali untuk semua pasien, jenis USG pilihan,
   pesan WA otomatis + persiapan per jenis USG, pasien terkirim masuk ke tab Data Pasien (per tanggal & jenis). */
(function () {
  'use strict';
  var KEY = 'rekap-radiologi-reminder-usg-v1', PKEY = 'rekap-radiologi-reminder-usg-prep-v2', AKEY = 'rekap-radiologi-reminder-usg-alur-v1', UKEY = 'rekap-radiologi-reminder-usg-petugas-v1';
  // Mengikuti sheet MASTER REMINDER_H-1_USG_RAJAL_RSSM.xlsx
  var JENIS = ['ABDOMEN FULL', 'PARTIAL / URO', 'MAMMAE', 'JARINGAN LUNAK', 'COLLI / LEHER', 'DOPPLER VASKULAR', 'DOPPLER TESTIS'];
  var DOKTER = { 'dr. Djoko': '16.30', 'dr. Kenny': '16.30', 'dr. Fatimah': '10.00' };
  var PETUGAS = ['Eni', 'Novi', 'Septiani', 'Fitri', 'Sinta Nadeak', 'Rafli'];
  var PENJAMIN = ['BPJS', 'Asuransi', 'Umum'];
  // Jam pemeriksaan -> jam makan terakhir & mulai minum
  var JAMTBL = { '16.30': { makan: '12.00 WIB siang', minum: '16.00 sore' }, '10.00': { makan: '05.00 WIB pagi', minum: '09.30 pagi' } };
  var LANGSUNG = 'Untuk pendaftaran *tidak perlu daftar online*\nSaat datang bisa langsung menuju *Radiologi*';
  var DEFAULT_ALUR = {
    'BPJS': LANGSUNG, 'Asuransi': LANGSUNG,
    'Umum': 'Untuk pendaftaran, mohon *daftar terlebih dahulu di bagian Pendaftaran/Registrasi*\nSetelah itu, silakan menuju ke *Radiologi*'
  };
  var TIDAK = '- Tidak ada persiapan khusus.';
  var AIR = '- Bawa air putih 1 ½ Liter, Jam {JAM_MINUM} minum air putih sedikit sedikit tapi sering dan mulai tahan pipis.';
  var DEFAULT_PREP = {
    'ABDOMEN FULL': '1. Puasa makan dengan makan terakhir di jam {MAKAN_TERAKHIR}, hanya boleh minum air putih.\n2. Bawa air putih 1 ½ Liter, Jam {JAM_MINUM} minum air putih sedikit sedikit tapi sering dan mulai tahan pipis.',
    'PARTIAL / URO': AIR, 'MAMMAE': TIDAK, 'JARINGAN LUNAK': TIDAK, 'COLLI / LEHER': TIDAK, 'DOPPLER VASKULAR': TIDAK, 'DOPPLER TESTIS': TIDAK
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
  function salam() { var h = new Date().getHours(); return h >= 4 && h < 11 ? 'Pagi' : h >= 11 && h < 15 ? 'Siang' : h >= 15 && h < 18 ? 'Sore' : 'Malam'; }

  function loadJSON(k, fb) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function load() { var a = loadJSON(KEY, []); return Array.isArray(a) ? a : []; }
  function save(a) { return saveJSON(KEY, a); }
  function objOf(k) { var o = loadJSON(k, {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  function prepOf(j) { var o = objOf(PKEY); return o[j] != null ? o[j] : (DEFAULT_PREP[j] || ''); }
  function alurOf(p) { var o = objOf(AKEY); return o[p] != null ? o[p] : (DEFAULT_ALUR[p] || ''); }

  function normPhone(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.indexOf('8') === 0) d = '62' + d;
    return /^62\d{8,13}$/.test(d) ? d : '';
  }
  function stateOf(p) { var t = todayKey(), h1 = addDays(p.tanggal, -1); return h1 === t ? 'siap' : h1 > t ? 'tunggu' : 'lewat'; }
  // Pesan mengikuti rumus kolom "Teks Pesan" di sheet INPUT
  function fill(p) {
    var jam = p.jam || DOKTER[p.dokter] || '', t = JAMTBL[jam] || { makan: '', minum: '' };
    var prep = prepOf(p.jenis || '').replace(/\{MAKAN_TERAKHIR\}/g, t.makan).replace(/\{JAM_MINUM\}/g, t.minum);
    var d = obj(p.tanggal), dd = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    var besok = p.tanggal === addDays(todayKey(), 1);
    var out = 'Selamat ' + salam() + ' bpk/ibu ' + p.nama + ', Saya ' + (p.petugas || '') + ' petugas Radiologi Rs.Setia Mitra, saya ingin mengkonfirmasi kembali untuk pemeriksaan USG yang saya jadwalkan ' +
      (besok ? 'besok di hari ' : 'pada hari ') + DAYS[d.getDay()] + ', ' + dd + ' *jam ' + jam + ' WIB*\n\n';
    if (prep.trim()) out += '*Persiapannya:*\n' + prep + '\n\n';
    var alur = alurOf(p.penjamin || '');
    if (alur.trim()) out += alur + '\n\n';
    out += 'Mohon konfirmasi kedatangannya ya\nTerimakasih\n\n*NB: Untuk hasil Usg dapat diambil sebelum bertemu dokter saat kontrol kembali DI RADIOLOGI*';
    return out;
  }

  var data = load(), tab = 'kirim', dpMonth = '';

  function opts(list, sel, ph) {
    return '<option value="">' + ph + '</option>' + list.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + ' value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
  }
  function shell() {
    var lastPetugas = ''; try { lastPetugas = localStorage.getItem(UKEY) || ''; } catch (e) {}
    $('reminderApp').innerHTML =
      '<div class="seg rm-tabs" id="rmTabs"><button type="button" data-t="kirim" class="on">Kirim Reminder</button><button type="button" data-t="data">Data Pasien</button></div>' +
      '<div id="rmPaneKirim">' +
        '<div id="rmBanner" class="rm-banner" role="status" aria-live="polite"></div>' +
        '<div id="rmQueue" class="rm-queue" hidden></div>' +
        '<form id="rmForm" class="rm-batch" autocomplete="off">' +
          '<div class="rm-batchhead"><h3>Input pasien</h3></div>' +
          '<div class="rm-shared">' +
            '<label>Petugas<select id="rmPetugas">' + opts(PETUGAS, lastPetugas, 'Pilih petugas') + '</select></label>' +
            '<label>Tanggal pemeriksaan (semua pasien)<input id="rmDate" type="date" min="' + todayKey() + '"></label>' +
          '</div>' +
          '<div class="rm-scan-tools"><div><strong>Isi otomatis dari kertas pasien</strong><p class="hint">Foto atau pilih gambar kertas. AI membaca tulisan tangan lalu mengisi kolom pasien yang sama; hasil tetap bisa diedit sebelum dikirim.</p></div><label class="rm-scan-button" for="rmScanFile"><span aria-hidden="true">▧</span> Scan dengan AI</label><input id="rmScanFile" type="file" accept="image/*" capture="environment" hidden><p id="rmScanStatus" class="rm-scan-status" role="status" aria-live="polite"></p></div>' +
          '<div class="rm-bulk-defaults">' +
            '<div class="rm-bulk-field"><label for="rmBulkDoctor">Dokter untuk semua pasien</label><div class="rm-bulk-control"><select id="rmBulkDoctor">' + opts(Object.keys(DOKTER), '', 'Pilih dokter') + '</select><button type="button" class="secondary" data-apply-doctor>Terapkan</button></div></div>' +
            '<div class="rm-bulk-field"><label for="rmBulkPayer">Penjamin untuk semua pasien</label><div class="rm-bulk-control"><select id="rmBulkPayer">' + opts(PENJAMIN, '', 'Pilih penjamin') + '</select><button type="button" class="secondary" data-apply-payer>Terapkan</button></div></div>' +
          '</div>' +
          '<p class="hint rm-bulk-hint">Pilih dokter atau penjamin, lalu tekan Terapkan. Pilihan akan mengisi seluruh baris dan tetap bisa diubah satu per satu.</p>' +
          '<div class="rm-rowshead"><span>#</span><span>Nama pasien</span><span>No. WhatsApp</span><span>Jenis pemeriksaan</span><span>Dokter</span><span>Penjamin</span><span></span></div>' +
          '<div id="rmRows" class="rm-rows"></div>' +
          '<div class="rm-batchfoot"><button type="button" id="rmAdd" class="secondary">+ Tambah baris</button><button type="button" id="rmAdd5" class="secondary">+ 5 baris</button></div>' +
          '<p class="hint rm-row-hint">Tekan <b>Kirim WA + Simpan</b> pada baris pasien yang ingin diproses. Data disimpan satu per satu sebelum WhatsApp dibuka.</p>' +
        '</form>' +
        '<p id="rmMsg" class="muted rm-msg" role="status" aria-live="polite"></p>' +
        '<details class="rm-tpl"><summary>Persiapan &amp; alur pendaftaran dalam pesan</summary>' +
          '<p class="hint">Persiapan per jenis pemeriksaan. Kosongkan jika tidak ada (bagian "Persiapannya" tidak muncul). Kode: {MAKAN_TERAKHIR} dan {JAM_MINUM} terisi otomatis dari jam pemeriksaan dokter. Gunakan *teks* untuk cetak tebal di WhatsApp. Perubahan tersimpan otomatis.</p>' +
          '<div id="rmPrep" class="rm-prep"></div>' +
          '<h4 class="rm-h4">Alur pendaftaran per penjamin</h4>' +
          '<div id="rmAlur" class="rm-prep"></div>' +
          '<button type="button" id="rmPrepReset" class="secondary">Kembalikan bawaan</button>' +
          '<h4 class="rm-h4">Pratinjau pesan</h4><pre id="rmPreview" class="rm-preview"></pre>' +
        '</details>' +
        '<div class="rm-listhead"><h3>Belum dikirim</h3></div><div id="rmList" class="rm-list"></div>' +
      '</div>' +
      '<div id="rmPaneData" hidden></div>';
    $('rmPrep').innerHTML = JENIS.map(function (j) { return '<label>' + esc(j) + '<textarea rows="3" data-prep="' + esc(j) + '"></textarea></label>'; }).join('');
    $('rmAlur').innerHTML = PENJAMIN.map(function (p) { return '<label>' + esc(p) + '<textarea rows="2" data-alur="' + esc(p) + '"></textarea></label>'; }).join('');
    fillPrepBoxes(); renderRows([]); preview();
  }
  function fillPrepBoxes() {
    document.querySelectorAll('#rmPrep textarea').forEach(function (t) { t.value = prepOf(t.dataset.prep); });
    document.querySelectorAll('#rmAlur textarea').forEach(function (t) { t.value = alurOf(t.dataset.alur); });
  }
  function preview() {
    var el = $('rmPreview'); if (!el) return;
    el.textContent = fill({ nama: 'Contoh Pasien', petugas: $('rmPetugas').value || PETUGAS[0], tanggal: addDays(todayKey(), 1), jenis: 'ABDOMEN FULL', dokter: 'dr. Djoko', penjamin: 'BPJS' });
  }

  function render() {
    var t = todayKey(), tomorrow = addDays(t, 1);
    var pending = data.filter(function (p) { return p.status !== 'terkirim' && p.status !== 'tersimpan'; });
    var due = pending.filter(function (p) { return stateOf(p) === 'siap'; });
    var b = $('rmBanner');
    b.className = 'rm-banner' + (due.length ? ' is-due' : '');
    b.innerHTML = due.length
      ? '<div><strong>' + due.length + ' pasien perlu dikirimi reminder hari ini</strong><span>Pemeriksaan besok, ' + esc(longDate(tomorrow)) + '. Kirim dan simpan setiap pasien melalui tombol pada barisnya.</span></div>'
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
      '<div class="rm-main"><strong>' + esc(p.nama) + '</strong><span>+' + esc(p.wa) + ' · ' + esc(p.jenis || 'Jenis belum dipilih') + '</span><small>Periksa: ' + esc(longDate(p.tanggal)) + (p.jam || DOKTER[p.dokter] ? ' · ' + esc(p.jam || DOKTER[p.dokter]) + ' WIB' : '') + (p.dokter ? ' · ' + esc(p.dokter) : '') + (p.penjamin ? ' · ' + esc(p.penjamin) : '') + '</small></div>' +
      '<div class="rm-side">' + chip + '<div class="rm-actions">' +
        '<button type="button" class="primary-action" data-act="send" data-id="' + esc(p.id) + '"' + tip + '>Kirim WA + Simpan</button>' +
        '<button type="button" class="danger" data-act="del" data-id="' + esc(p.id) + '">Hapus</button>' +
      '</div></div></article>';
  }

  // ---- Tab Data Pasien: hanya yang sudah dikirim, dikelompokkan per tanggal pemeriksaan lalu jenis USG
  function renderData() {
    var host = $('rmPaneData'); if (!host) return;
    var sent = data.filter(function (p) { return p.status === 'terkirim' || p.status === 'tersimpan'; });
    var months = {}; sent.forEach(function (p) { months[p.tanggal.slice(0, 7)] = 1; });
    var mlist = Object.keys(months).sort().reverse();
    if (!dpMonth || !months[dpMonth]) dpMonth = mlist[0] || '';
    var shown = sent.filter(function (p) { return p.tanggal.slice(0, 7) === dpMonth; });
    var byDate = {}; shown.forEach(function (p) { (byDate[p.tanggal] = byDate[p.tanggal] || []).push(p); });
    var html = '<div class="rm-listhead"><h3>Data pasien tersimpan</h3>' +
      (mlist.length ? '<label class="rm-same">Bulan<select id="rmDpMonth">' + mlist.map(function (m) { var y = m.slice(0, 4), mo = Number(m.slice(5)); return '<option value="' + m + '"' + (m === dpMonth ? ' selected' : '') + '>' + MONTHS[mo - 1] + ' ' + y + '</option>'; }).join('') + '</select></label>' : '') + '</div>';
    if (!sent.length) html += '<p class="empty-state">Belum ada data pasien tersimpan. Pasien yang diproses melalui tombol per baris akan masuk ke sini.</p>';
    else {
      html += '<p class="muted">' + shown.length + ' pasien pada bulan ini.</p>';
      html += Object.keys(byDate).sort().map(function (d) {
        var byJ = {}; byDate[d].forEach(function (p) { var j = p.jenis || 'Jenis belum dipilih'; (byJ[j] = byJ[j] || []).push(p); });
        return '<section class="rm-dp"><h4>' + esc(longDate(d)) + ' <small>' + byDate[d].length + ' pasien</small></h4>' +
          Object.keys(byJ).sort().map(function (j) {
            return '<div class="rm-dpj"><div class="rm-dpjh"><b>' + esc(j) + '</b><span>' + byJ[j].length + ' pasien</span></div><ul>' +
              byJ[j].sort(function (a, c) { return a.nama.localeCompare(c.nama); }).map(function (p) {
                return '<li><span><strong>' + esc(p.nama) + '</strong> · +' + esc(p.wa) + '<small class="rm-saved-status">' + (p.status === 'terkirim' ? 'Status lama: ditandai terkirim' : 'Tersimpan · WhatsApp dibuka, pengiriman belum terverifikasi') + '</small></span><button type="button" class="danger" data-act="del" data-id="' + esc(p.id) + '">Hapus</button></li>';
              }).join('') + '</ul></div>';
          }).join('') + '</section>';
      }).join('');
    }
    host.innerHTML = html;
  }

  function say(text, bad) { var m = $('rmMsg'); m.textContent = text; m.classList.toggle('bad', !!bad); }

  var MINROWS = 10;
  function rowHTML(i, v) {
    var n = i + 1;
    return '<div class="rm-row' + (v.bad ? ' is-bad' : '') + '"><span class="rm-no">' + n + '</span>' +
      '<input class="rn" type="text" maxlength="80" placeholder="Nama lengkap" aria-label="Nama pasien baris ' + n + '" value="' + esc(v.n || '') + '">' +
      '<input class="rw" type="tel" inputmode="tel" placeholder="0812xxxxxxxx" aria-label="No. WhatsApp baris ' + n + '" value="' + esc(v.w || '') + '">' +
      '<select class="rj" aria-label="Jenis pemeriksaan baris ' + n + '">' + opts(JENIS, v.j || '', 'Pilih jenis') + '</select>' +
      '<select class="rd" aria-label="Dokter baris ' + n + '">' + opts(Object.keys(DOKTER), v.d || '', 'Dokter') + '</select>' +
      '<select class="rp" aria-label="Penjamin baris ' + n + '">' + opts(PENJAMIN, v.p || '', 'Penjamin') + '</select>' +
      '<button type="button" class="rm-x" data-rm aria-label="Hapus baris ' + n + '">\u00d7</button>' +
      '<button type="button" class="primary-action rm-row-send" data-row-send>Kirim WA + Simpan</button></div>';
  }
  function renderRows(vals) {
    var list = vals.slice(); while (list.length < MINROWS) list.push({});
    $('rmRows').innerHTML = list.map(function (v, i) { return rowHTML(i, v); }).join('');
  }
  function readRows() {
    return Array.prototype.map.call(document.querySelectorAll('#rmRows .rm-row'), function (r) {
      return { n: r.querySelector('.rn').value, w: r.querySelector('.rw').value, j: r.querySelector('.rj').value, d: r.querySelector('.rd').value, p: r.querySelector('.rp').value };
    });
  }
  function addRows(n) {
    var vals = readRows(); for (var i = 0; i < n; i++) vals.push({});
    renderRows(vals);
    var inputs = document.querySelectorAll('#rmRows .rn'); inputs[inputs.length - n].focus();
  }

  function applyBulkValue(selector, value, label) {
    if (!value) return say('Pilih ' + label + ' terlebih dahulu.', true);
    var rows = document.querySelectorAll('#rmRows .rm-row');
    rows.forEach(function (row) { row.querySelector(selector).value = value; row.classList.remove('is-bad'); });
    say(label + ' berhasil diterapkan ke ' + rows.length + ' baris. Setiap baris tetap bisa diedit.', false);
    preview();
  }

  function saveOneRow(row) {
    var tgl = $('rmDate').value, petugas = $('rmPetugas').value;
    var r = { n: row.querySelector('.rn').value, w: row.querySelector('.rw').value,
      j: row.querySelector('.rj').value, d: row.querySelector('.rd').value, p: row.querySelector('.rp').value };
    var nama = r.n.trim(), wa = normPhone(r.w), problem = '';
    if (!nama) problem = 'Nama pasien belum diisi.';
    else if (!wa) problem = 'Nomor WhatsApp tidak valid.';
    else if (!r.j) problem = 'Pilih jenis pemeriksaan.';
    else if (!r.d) problem = 'Pilih dokter.';
    else if (!r.p) problem = 'Pilih penjamin.';
    else if (!petugas) problem = 'Pilih petugas terlebih dahulu.';
    else if (!tgl) problem = 'Isi tanggal pemeriksaan terlebih dahulu.';
    else if (tgl < todayKey()) problem = 'Tanggal pemeriksaan sudah lewat.';
    else if (data.some(function (p) { return p.wa === wa && p.tanggal === tgl && p.jenis === r.j; })) problem = 'Pasien dengan nomor WA, tanggal, dan jenis pemeriksaan ini sudah tercatat.';
    if (problem) { row.classList.add('is-bad'); say(problem, true); return; }

    var p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      nama: nama, wa: wa, jenis: r.j, dokter: r.d, jam: DOKTER[r.d], penjamin: r.p,
      petugas: petugas, tanggal: tgl, status: 'tersimpan', dibuat: new Date().toISOString() };
    data.push(p);
    if (!save(data)) { data.pop(); say('Gagal menyimpan data. Periksa ruang penyimpanan browser.', true); return; }
    try { localStorage.setItem(UKEY, petugas); } catch (x) {}
    // Simpan lebih dahulu; setelah itu buka WhatsApp. Pengiriman tetap harus ditekan manual di WhatsApp.
    openWA(p);
    row.querySelectorAll('input,select').forEach(function (el) { el.value = ''; });
    row.classList.remove('is-bad');
    say('Data ' + nama + ' berhasil disimpan. WhatsApp dibuka; tekan tombol Kirim di WhatsApp untuk mengirim pesan.', false);
    render();
  }

  function onSubmit(e) {
    e.preventDefault();
    var tgl = $('rmDate').value, petugas = $('rmPetugas').value;
    var rows = readRows(), isFilled = function (r) { return r.n.trim() || r.w.trim() || r.j || r.d || r.p; };
    // Baris yang sama sekali kosong dibiarkan, tidak ditandai.
    if (!rows.some(isFilled)) return say('Belum ada data yang diisi.', true);
    if (!petugas) return say('Pilih petugas dulu.', true);
    if (!tgl) return say('Isi tanggal pemeriksaan dulu (berlaku untuk semua pasien).', true);
    if (tgl < todayKey()) return say('Tanggal pemeriksaan sudah lewat.', true);
    try { localStorage.setItem(UKEY, petugas); } catch (x) {}
    var saved = 0, keep = [], errs = [];
    rows.forEach(function (r, i) {
      if (!isFilled(r)) return;
      var nama = r.n.trim(), wa = normPhone(r.w), problem = '';
      if (!nama) problem = 'nama kosong';
      else if (!wa) problem = 'No. WA tidak valid';
      else if (!r.j) problem = 'jenis pemeriksaan belum dipilih';
      else if (!r.d) problem = 'dokter belum dipilih';
      else if (!r.p) problem = 'penjamin belum dipilih';
      else if (data.some(function (p) { return p.wa === wa && p.tanggal === tgl && p.jenis === r.j; })) problem = 'sudah tercatat';
      if (problem) { keep.push({ n: r.n, w: r.w, j: r.j, d: r.d, p: r.p, bad: true }); errs.push('Baris ' + (i + 1) + ': ' + problem); return; }
      data.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nama: nama, wa: wa, jenis: r.j, dokter: r.d, jam: DOKTER[r.d], penjamin: r.p, petugas: petugas, tanggal: tgl, status: 'belum', dibuat: new Date().toISOString() });
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

  function scanStatus(message, bad) {
    var el = $('rmScanStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('bad', !!bad);
  }

  // Endpoint Cloudflare Worker. API key AI tidak pernah disimpan di browser/GitHub.
  function aiOcrEndpoint() {
    return String(window.RM_AI_OCR_ENDPOINT || '').trim();
  }
  function prepareScanImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var maxSide = 1800;
          var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          var w = Math.max(1, Math.round(img.naturalWidth * scale));
          var h = Math.max(1, Math.round(img.naturalHeight * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error('Foto gagal diproses.'));
            if (blob.size > 5 * 1024 * 1024) return reject(new Error('Ukuran foto masih terlalu besar. Ambil foto dengan resolusi lebih rendah.'));
            var reader = new FileReader();
            reader.onload = function () {
              var dataUrl = String(reader.result || '');
              resolve({ image: dataUrl, mimeType: blob.type || 'image/jpeg' });
            };
            reader.onerror = function () { reject(new Error('Foto gagal disiapkan untuk AI.')); };
            reader.readAsDataURL(blob);
          }, 'image/jpeg', 0.78);
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('File foto tidak dapat dibuka.')); };
      img.src = url;
    });
  }
  function cleanAIValue(value, max) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 120) : '';
  }
  function normalizeAIExam(value) {
    var v = cleanAIValue(value, 100).toUpperCase().replace(/[.,;:_-]/g, ' ').replace(/\s+/g, ' ');
    if (/\b(ABDOMEN|ABD|ABDN|ABDOM|ABDOMN|ABDOMINAL)\b/.test(v)) return 'ABDOMEN FULL';
    if (/\b(PARTIAL|PART|URO|UROLOGI|TRACTUS URINARIUS)\b/.test(v)) return 'PARTIAL / URO';
    if (/\b(MAMMAE|MAMAE|MAMMA|MAM|PAYUDARA|BREAST)\b/.test(v)) return 'MAMMAE';
    if (/\b(JARINGAN LUNAK|SOFT TISSUE)\b/.test(v)) return 'JARINGAN LUNAK';
    if (/\b(COLLI|COLI|LEHER|THYROID|TIROID)\b/.test(v)) return 'COLLI / LEHER';
    if (/DOPPLER.*(VASKULAR|VASCULAR)|\b(VASKULAR|VASCULAR)\b/.test(v)) return 'DOPPLER VASKULAR';
    if (/DOPPLER.*TESTIS|\b(TESTIS|SCROTUM|SKROTUM)\b/.test(v)) return 'DOPPLER TESTIS';
    return '';
  }
  function normalizeAIDoctor(value) {
    var raw = cleanAIValue(value, 100).toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-z]/g, '');
    if (!raw) return '';
    var names = Object.keys(DOKTER);
    for (var i = 0; i < names.length; i++) {
      var key = names[i].toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-z]/g, '');
      if (key && (raw === key || raw.indexOf(key) >= 0 || key.indexOf(raw) >= 0 && raw.length >= 5)) return names[i];
    }
    return '';
  }
  function parseAIResult(data) {
    var confidence = data && data.confidence && typeof data.confidence === 'object' ? data.confidence : {};
    var name = cleanAIValue(data && data.nama, 80);
    var wa = cleanAIValue(data && data.wa, 24).replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/[^\d+]/g, '');
    if (wa && !/^(?:\+?62|0|8)\d{7,14}$/.test(wa)) wa = '';
    var exam = normalizeAIExam(data && data.jenis);
    var doctor = normalizeAIDoctor(data && data.dokter);
    var date = cleanAIValue(data && data.tanggal, 10);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00'))) date = '';
    // Nama dan nomor tidak ditebak/dikoreksi otomatis; confidence rendah dikosongkan.
    if (Number(confidence.nama) < 0.55) name = '';
    if (Number(confidence.wa) < 0.65) wa = '';
    if (Number(confidence.jenis) < 0.55) exam = '';
    if (Number(confidence.dokter) < 0.60) doctor = '';
    return { nama: name, wa: wa, jenis: exam, dokter: doctor, tanggal: date };
  }
  function requestAIReading(file) {
    var endpoint = aiOcrEndpoint();
    if (!endpoint) return Promise.reject(new Error('AI belum diaktifkan. Pasang URL Cloudflare Worker pada konfigurasi RM_AI_OCR_ENDPOINT terlebih dahulu.'));
    return prepareScanImage(file).then(function (prepared) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 28000) : null;
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prepared),
        signal: controller ? controller.signal : undefined
      }).then(function (response) {
        if (!response.ok) return response.json().catch(function () { return {}; }).then(function (err) {
          throw new Error(err.error || ('Layanan AI gagal (HTTP ' + response.status + ').'));
        });
        return response.json();
      }).then(function (payload) {
        if (!payload || payload.ok !== true || !payload.data) throw new Error('Jawaban AI tidak sesuai format. Coba foto ulang atau isi manual.');
        return parseAIResult(payload.data);
      }).catch(function (err) {
        if (err && err.name === 'AbortError') throw new Error('Pembacaan AI melewati batas 28 detik. Periksa koneksi lalu coba lagi.');
        throw err;
      }).finally(function () { if (timer) clearTimeout(timer); });
    });
  }
  function firstAvailableRow() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#rmRows .rm-row'));
    return rows.find(function (r) { return !r.querySelector('.rn').value.trim() && !r.querySelector('.rw').value.trim(); }) || null;
  }
  function applyScanToForm(file) {
    if (!file || !/^image\//.test(file.type)) return scanStatus('Pilih file gambar kertas pasien.', true);
    if (file.size > 15 * 1024 * 1024) return scanStatus('Ukuran foto maksimal 15 MB. Kompres atau foto ulang.', true);
    scanStatus('Mengoptimalkan foto lalu membaca tulisan tangan dengan AI…');
    requestAIReading(file).then(function (parsed) {
      var row = firstAvailableRow();
      if (!row) { addRows(1); row = firstAvailableRow(); }
      if (!row) throw new Error('Tidak dapat menyiapkan baris pasien.');
      if (parsed.nama) row.querySelector('.rn').value = parsed.nama;
      if (parsed.wa) row.querySelector('.rw').value = parsed.wa;
      if (parsed.jenis) row.querySelector('.rj').value = parsed.jenis;
      if (parsed.dokter) row.querySelector('.rd').value = parsed.dokter;
      if (parsed.tanggal && !$('rmDate').value) $('rmDate').value = parsed.tanggal;
      row.classList.remove('is-bad');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (parsed.nama) row.querySelector('.rn').focus();
      var fields = [
        ['nama', parsed.nama], ['nomor WA', parsed.wa],
        ['jenis USG', parsed.jenis], ['dokter pemeriksa/radiologi', parsed.dokter]
      ];
      var found = fields.filter(function (x) { return !!x[1]; }).map(function (x) { return x[0]; });
      var missing = fields.filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; });
      scanStatus((found.length ? 'AI membaca: ' + found.join(', ') + '. ' : 'AI belum berhasil mengenali data utama. ') +
        (missing.length ? 'Lengkapi/periksa: ' + missing.join(', ') + '. ' : 'Data utama berhasil dikenali. ') +
        'Semua kolom tetap bisa diedit. Periksa kembali sebelum Kirim WA + Simpan.', missing.length > 0);
    }).catch(function (err) {
      scanStatus((err && err.message) || 'Scan AI gagal. Coba foto lebih terang, fokus, dan tidak miring; atau isi manual.', true);
    });
  }

  function firstAvailableRow() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#rmRows .rm-row'));
    return rows.find(function (r) { return !r.querySelector('.rn').value.trim() && !r.querySelector('.rw').value.trim(); }) || null;
  }
  function applyScanToForm(file) {
    if (!file || !/^image\//.test(file.type)) return scanStatus('Pilih file gambar kertas pasien.', true);
    scanStatus('Menyiapkan foto dan membaca tulisan tangan…');
    Promise.all([loadTesseract(), imageVariants(file)]).then(function (parts) {
      var Tesseract = parts[0], variants = parts[1], worker;
      return Tesseract.createWorker('ind+eng', 1, { logger: function (m) {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') scanStatus('Membaca tulisan tangan… ' + Math.round(m.progress * 100) + '%');
      }}).then(function (w) { worker = w; return worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' }); })
        .then(function () { return worker.recognize(variants[0]); })
        .then(function (first) {
          var p1 = parseScanText(first.data && first.data.text || '');
          var score = [p1.nama, p1.wa, p1.jenis, p1.dokter].filter(Boolean).length;
          if (score >= 3) return { parsed: p1, worker: worker };
          scanStatus('Memperjelas foto untuk meningkatkan pembacaan…');
          return worker.recognize(variants[1]).then(function (second) {
            var p2 = parseScanText(second.data && second.data.text || '');
            var s2 = [p2.nama, p2.wa, p2.jenis, p2.dokter].filter(Boolean).length;
            return { parsed: s2 > score ? p2 : p1, worker: worker };
          });
        }).then(function (result) { return worker.terminate().then(function () { return result.parsed; }); }, function (err) { if (worker) worker.terminate(); throw err; });
    }).then(function (parsed) {
      var row = firstAvailableRow();
      if (!row) { addRows(1); row = firstAvailableRow(); }
      if (!row) throw new Error('Tidak dapat menyiapkan baris pasien.');
      if (parsed.nama) row.querySelector('.rn').value = parsed.nama;
      if (parsed.wa) row.querySelector('.rw').value = parsed.wa;
      if (parsed.jenis) row.querySelector('.rj').value = parsed.jenis;
      if (parsed.dokter) row.querySelector('.rd').value = parsed.dokter;
      if (parsed.tanggal && !$('rmDate').value) $('rmDate').value = parsed.tanggal;
      row.classList.remove('is-bad');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (parsed.nama) row.querySelector('.rn').focus();
      var critical = [parsed.nama && 'nama', parsed.wa && 'nomor WA', parsed.jenis && 'jenis USG', parsed.dokter && 'dokter pemeriksa/radiologi'].filter(Boolean);
      var missing = ['nama', 'nomor WA', 'jenis USG', 'dokter pemeriksa/radiologi'].filter(function (x) {
        return !({ 'nama': parsed.nama, 'nomor WA': parsed.wa, 'jenis USG': parsed.jenis, 'dokter pemeriksa/radiologi': parsed.dokter })[x];
      });
      scanStatus((critical.length ? 'Terbaca: ' + critical.join(', ') + '. ' : 'Belum ada data utama yang dikenali. ') +
        (missing.length ? 'Periksa/isi manual: ' + missing.join(', ') + '. ' : 'Data utama terdeteksi. ') +
        'Semua kolom tetap bisa diedit. Pastikan nama, nomor WA, dokter, dan jenis USG benar sebelum Kirim WA + Simpan.', missing.length > 0);
      if (parsed.noRM) scanStatus(($('rmScanStatus').textContent || '') + ' No. RM terdeteksi tetapi belum memiliki kolom input.');
    }).catch(function (err) {
      scanStatus((err && err.message) || 'Scan gagal. Coba foto lebih dekat, terang, tidak miring, atau isi manual.', true);
    });
  }

  function init() {
    if (!$('reminderApp')) return;
    shell(); render();
    $('rmForm').addEventListener('submit', function (e) { e.preventDefault(); });
    $('rmScanFile').addEventListener('change', function (e) { var file = e.target.files && e.target.files[0]; if (file) applyScanToForm(file); e.target.value = ''; });
    $('rmRows').addEventListener('click', function (e) { var b = e.target.closest('[data-row-send]'); if (b) saveOneRow(b.closest('.rm-row')); });
    $('rmForm').addEventListener('click', function (e) {
      var doctor = e.target.closest('[data-apply-doctor]');
      var payer = e.target.closest('[data-apply-payer]');
      if (doctor) applyBulkValue('.rd', $('rmBulkDoctor').value, 'Dokter');
      if (payer) applyBulkValue('.rp', $('rmBulkPayer').value, 'Penjamin');
    });
    $('rmAdd').addEventListener('click', function () { addRows(1); });
    $('rmAdd5').addEventListener('click', function () { addRows(5); });
    $('rmRows').addEventListener('click', function (e) {
      var x = e.target.closest('[data-rm]'); if (!x) return;
      var row = x.closest('.rm-row'), rows = document.querySelectorAll('#rmRows .rm-row');
      if (rows.length > MINROWS) { var vals = readRows(); vals.splice(Array.prototype.indexOf.call(rows, row), 1); renderRows(vals); }
      else { row.querySelectorAll('input,select').forEach(function (i) { i.value = ''; }); row.classList.remove('is-bad'); }
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
    $('rmPrep').addEventListener('input', function (e) {
      var j = e.target.dataset.prep; if (!j) return;
      var o = objOf(PKEY); o[j] = e.target.value; saveJSON(PKEY, o); preview();
    });
    $('rmAlur').addEventListener('input', function (e) {
      var p = e.target.dataset.alur; if (!p) return;
      var o = objOf(AKEY); o[p] = e.target.value; saveJSON(AKEY, o); preview();
    });
    $('rmPrepReset').addEventListener('click', function () {
      try { localStorage.removeItem(PKEY); localStorage.removeItem(AKEY); } catch (x) {}
      fillPrepBoxes(); preview();
    });
    $('rmPetugas').addEventListener('change', preview);
    // segarkan status H-1 dan daftar jenis USG setiap modul dibuka
    var v = $('v-reminder');
    if (v) new MutationObserver(function () {
      if (v.hidden) return;
      render();
    }).observe(v, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
