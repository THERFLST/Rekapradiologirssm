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
      '<div class="nav rm-tabs" id="rmTabs"><button type="button" data-t="kirim" class="on">Kirim Reminder</button><button type="button" data-t="data">Data Pasien</button></div>' +
      '<div id="rmPaneKirim">' +
        '<div id="rmBanner" class="rm-banner" role="status" aria-live="polite"></div>' +
        '<div id="rmQueue" class="rm-queue" hidden></div>' +
        '<form id="rmForm" class="rm-batch" autocomplete="off">' +
          '<div class="rm-batchhead"><h3>Input pasien</h3></div>' +
          '<div class="rm-shared">' +
            '<label>Petugas<select id="rmPetugas">' + opts(PETUGAS, lastPetugas, 'Pilih petugas') + '</select></label>' +
            '<label>Tanggal pemeriksaan (semua pasien)<input id="rmDate" type="date" min="' + todayKey() + '"></label>' +
            '<p id="rmDateHint" class="hint rm-datehint" role="status" aria-live="polite"></p>' +
          '</div>' +
          '<div class="rm-scan-tools"><div><strong>Isi otomatis dari kertas pasien</strong>' +
            '<p class="hint">Tanpa AI, tanpa biaya, langsung di HP. <b>iPhone:</b> ketuk kotak di bawah → <b>Scan Text</b> (ikon kamera) → arahkan ke kertas → <b>Insert</b>. Atau buka foto kertas → tahan tulisan → <b>Salin Semua</b> → tempel di sini. Boleh banyak kertas sekaligus.</p></div>' +
            '<textarea id="rmScanText" class="rm-scan-text" rows="4" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Hasil scan/teks kertas muncul di sini…"></textarea>' +
            '<div class="rm-scan-actions"><button type="button" id="rmScanParse" class="rm-scan-button rm-scan-go">Isi dari teks</button><button type="button" id="rmScanTextClear" class="rm-scan-button">Hapus teks</button>' +
            (aiOcrEndpoint() ? '<label class="rm-scan-button" for="rmScanCam">Foto + AI</label><label class="rm-scan-button" for="rmScanFile">Galeri + AI</label>' : '') + '</div>' +
            (aiOcrEndpoint() ? '<input id="rmScanCam" type="file" accept="image/*" capture="environment" hidden><input id="rmScanFile" type="file" accept="image/*" multiple hidden>' : '') +
            '<p id="rmScanStatus" class="rm-scan-status" role="status" aria-live="polite"></p></div>' +
          '<div class="rm-bulk-defaults">' +
            '<div class="rm-bulk-field"><label for="rmBulkDoctor">Dokter untuk semua pasien</label><div class="rm-bulk-control"><select id="rmBulkDoctor">' + opts(Object.keys(DOKTER), '', 'Pilih dokter') + '</select><button type="button" class="secondary" data-apply-doctor>Terapkan</button></div></div>' +
            '<div class="rm-bulk-field"><label for="rmBulkPayer">Penjamin untuk semua pasien</label><div class="rm-bulk-control"><select id="rmBulkPayer">' + opts(PENJAMIN, '', 'Pilih penjamin') + '</select><button type="button" class="secondary" data-apply-payer>Terapkan</button></div></div>' +
          '</div>' +
          '<p class="hint rm-bulk-hint">Pilih dokter atau penjamin, lalu tekan Terapkan. Pilihan akan mengisi seluruh baris dan tetap bisa diubah satu per satu.</p>' +
          '<div class="rm-rowshead"><span>#</span><span>Nama pasien</span><span>No. WhatsApp</span><span>Jenis pemeriksaan</span><span>Dokter</span><span>Penjamin</span><span></span></div>' +
          '<div id="rmRows" class="rm-rows"></div>' +
          '<div class="rm-batchfoot"><button type="button" id="rmAdd" class="secondary">+ Tambah baris</button><button type="button" id="rmAdd5" class="secondary">+ 5 baris</button><button type="button" id="rmClearAll" class="danger">Kosongkan semua isi</button></div>' +
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
    fillPrepBoxes(); renderRows(new Array(STARTROWS).fill(0).map(function () { return {}; })); updateSendState(); preview();
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

  var MINROWS = 1, STARTROWS = 10;
  function rowHTML(i, v) {
    var n = i + 1;
    return '<div class="rm-row' + (v.bad ? ' is-bad' : '') + (v.pid ? ' is-sent' : '') + '"' + (v.pid ? ' data-pid="' + esc(v.pid) + '"' : '') + '><span class="rm-no">' + n + '</span>' +
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
      return { n: r.querySelector('.rn').value, w: r.querySelector('.rw').value, j: r.querySelector('.rj').value, d: r.querySelector('.rd').value, p: r.querySelector('.rp').value, pid: r.getAttribute('data-pid') || '' };
    });
  }
  function addRows(n) {
    var vals = readRows(); for (var i = 0; i < n; i++) vals.push({});
    renderRows(vals); updateSendState();
    var inputs = document.querySelectorAll('#rmRows .rn'); inputs[inputs.length - n].focus();
  }

  function applyBulkValue(selector, value, label) {
    if (!value) return say('Pilih ' + label + ' terlebih dahulu.', true);
    var rows = document.querySelectorAll('#rmRows .rm-row');
    rows.forEach(function (row) { row.querySelector(selector).value = value; row.classList.remove('is-bad'); });
    say(label + ' berhasil diterapkan ke ' + rows.length + ' baris. Setiap baris tetap bisa diedit.', false);
    preview();
  }

  function isH1(tgl) { return !!tgl && tgl === addDays(todayKey(), 1); }
  // Tombol kirim WA di setiap baris hanya aktif bila tanggal pemeriksaan = besok (H-1).
  function updateSendState() {
    var tgl = $('rmDate') ? $('rmDate').value : '', ok = isH1(tgl);
    var tip = ok ? '' : (tgl ? 'Hanya bisa dikirim H-1 (pemeriksaan besok, ' + shortDate(addDays(todayKey(), 1)) + ')' : 'Isi tanggal pemeriksaan (harus besok / H-1)');
    document.querySelectorAll('#rmRows [data-row-send]').forEach(function (b) { b.disabled = !ok; b.title = tip; });
    var h = $('rmDateHint');
    if (h) { h.textContent = tgl && !ok ? 'Bukan H-1: WhatsApp hanya bisa dikirim jika tanggal pemeriksaan besok (' + longDate(addDays(todayKey(), 1)) + ').' : ''; h.classList.toggle('bad', !!(tgl && !ok)); }
  }
  function clearAllRows() {
    var filled = readRows().some(function (r) { return r.n.trim() || r.w.trim() || r.j || r.d || r.p; });
    if (!filled) return say('Semua isian sudah kosong.', false);
    if (!confirm('Kosongkan semua isian pasien? Data yang sudah tersimpan di tab Data Pasien tidak ikut terhapus.')) return;
    renderRows(new Array(STARTROWS).fill(0).map(function () { return {}; }));
    updateSendState(); say('Semua isian dikosongkan.', false);
  }

  function clearMissing() { document.querySelectorAll('#rmForm .is-missing').forEach(function (e) { e.classList.remove('is-missing'); }); }
  function saveOneRow(row) {
    var tgl = $('rmDate').value, petugas = $('rmPetugas').value;
    var r = { n: row.querySelector('.rn').value, w: row.querySelector('.rw').value,
      j: row.querySelector('.rj').value, d: row.querySelector('.rd').value, p: row.querySelector('.rp').value };
    var nama = r.n.trim(), wa = normPhone(r.w), problem = '';
    // Tandai SEMUA kolom yang belum terisi (merah), bukan hanya yang pertama.
    clearMissing();
    var miss = [];
    function need(el, label, bad) { if (bad) { el.classList.add('is-missing'); miss.push(label); } }
    need(row.querySelector('.rn'), 'nama pasien', !nama);
    need(row.querySelector('.rw'), r.w.trim() ? 'nomor WhatsApp (tidak valid)' : 'nomor WhatsApp', !wa);
    need(row.querySelector('.rj'), 'jenis pemeriksaan', !r.j);
    need(row.querySelector('.rd'), 'dokter', !r.d);
    need(row.querySelector('.rp'), 'penjamin', !r.p);
    need($('rmPetugas'), 'petugas', !petugas);
    need($('rmDate'), 'tanggal pemeriksaan', !tgl);
    if (miss.length) { var first = document.querySelector('#rmForm .is-missing'); if (first && first.focus) first.focus(); return say('Belum diisi: ' + miss.join(', ') + '.', true); }
    if (!isH1(tgl)) problem = 'Reminder hanya bisa dikirim pada H-1. Ubah tanggal pemeriksaan menjadi besok (' + longDate(addDays(todayKey(), 1)) + ').';
    if (problem) { $('rmDate').classList.add('is-missing'); say(problem, true); return; }

    // Baris yang sudah pernah disimpan: cukup buka WhatsApp lagi, tanpa membuat data ganda.
    var pid = row.getAttribute('data-pid'), prev = pid && data.filter(function (x) { return x.id === pid; })[0];
    if (prev) { openWA(prev); say('WhatsApp dibuka lagi untuk ' + prev.nama + '. Data tidak disimpan ganda.', false); return; }
    if (data.some(function (p) { return p.wa === wa && p.tanggal === tgl && p.jenis === r.j; })) {
      row.classList.add('is-bad'); say('Pasien dengan nomor WA, tanggal, dan jenis pemeriksaan ini sudah tercatat.', true); return;
    }

    var p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      nama: nama, wa: wa, jenis: r.j, dokter: r.d, jam: DOKTER[r.d], penjamin: r.p,
      petugas: petugas, tanggal: tgl, status: 'tersimpan', dibuat: new Date().toISOString() };
    data.push(p);
    if (!save(data)) { data.pop(); say('Gagal menyimpan data. Periksa ruang penyimpanan browser.', true); return; }
    try { localStorage.setItem(UKEY, petugas); } catch (x) {}
    openWA(p);
    // Isian TIDAK dihapus otomatis; hapus manual lewat tombol × atau "Kosongkan semua isi".
    row.setAttribute('data-pid', p.id); row.classList.remove('is-bad'); row.classList.add('is-sent');
    say('Data ' + nama + ' berhasil disimpan. WhatsApp dibuka; tekan tombol Kirim di WhatsApp. Isian tetap ada sampai kamu hapus manual.', false);
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
          var maxSide = 1280;
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
          }, 'image/jpeg', 0.72);
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
    if (confidence.tanggal != null && Number(confidence.tanggal) < 0.5) date = '';
    var note = cleanAIValue(data && data.catatan, 140);
    return { nama: name, wa: wa, jenis: exam, dokter: doctor, tanggal: date, catatan: note };
  }
  function requestAIReading(file) {
    var endpoint = aiOcrEndpoint();
    if (!endpoint) return Promise.reject(new Error('AI belum diaktifkan. Pasang URL Cloudflare Worker pada konfigurasi RM_AI_OCR_ENDPOINT terlebih dahulu.'));
    return prepareScanImage(file).then(function (prepared) {
      var body = JSON.stringify(prepared);
      function attempt(n) {
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, 25000) : null;
        return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, signal: controller ? controller.signal : undefined })
          .then(function (response) {
            if (!response.ok) return response.json().catch(function () { return {}; }).then(function (err) {
              var e = new Error(err.error || ('Layanan AI gagal (HTTP ' + response.status + ').'));
              e.retry = response.status >= 500; throw e;
            });
            return response.json();
          })
          .then(function (payload) {
            if (!payload || payload.ok !== true || !payload.data) throw new Error('Jawaban AI tidak sesuai format. Coba foto ulang atau isi manual.');
            return parseAIResult(payload.data);
          })
          .catch(function (err) {
            var transient = err && (err.name === 'AbortError' || err.name === 'TypeError' || err.retry);
            if (transient && n < 1) return attempt(n + 1); // satu kali coba ulang otomatis
            if (err && err.name === 'AbortError') throw new Error('Pembacaan AI melewati batas waktu. Periksa koneksi lalu coba lagi.');
            throw err;
          })
          .finally(function () { if (timer) clearTimeout(timer); });
      }
      return attempt(0);
    });
  }
  function firstAvailableRow() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#rmRows .rm-row'));
    return rows.find(function (r) { return !r.querySelector('.rn').value.trim() && !r.querySelector('.rw').value.trim(); }) || null;
  }
  var scanBusy = false;
  function fillRowFromScan(parsed) {
    var row = firstAvailableRow();
    if (!row) { addRows(1); row = firstAvailableRow(); }
    if (!row) return null;
    if (parsed.nama) row.querySelector('.rn').value = parsed.nama;
    if (parsed.wa) row.querySelector('.rw').value = parsed.wa;
    if (parsed.jenis) row.querySelector('.rj').value = parsed.jenis;
    if (parsed.dokter) row.querySelector('.rd').value = parsed.dokter;
    row.classList.remove('is-bad');
    row.querySelectorAll('.is-missing').forEach(function (e) { e.classList.remove('is-missing'); });
    return row;
  }
  function finishScan(parsedList, total, secs, errMsg) {
    var notes = [], lastRow = null, firstDate = '', anyMiss = false;
    parsedList.forEach(function (parsed, idx) {
      var row = fillRowFromScan(parsed); if (!row) return; lastRow = lastRow || row;
      var miss = [['nama', parsed.nama], ['nomor WA', parsed.wa], ['jenis USG', parsed.jenis], ['dokter', parsed.dokter]]
        .filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; });
      var who = parsed.nama || ('kertas ' + (idx + 1));
      if (miss.length) { anyMiss = true; notes.push(who + ': periksa ' + miss.join(', ')); }
      if (parsed.tanggal && !firstDate) firstDate = parsed.tanggal;
      if (parsed.catatan) notes.push(who + ' — catatan kertas: ' + parsed.catatan);
    });
    if (firstDate) {
      if (!$('rmDate').value) { $('rmDate').value = firstDate; updateSendState(); notes.push('Tanggal pemeriksaan diisi ' + longDate(firstDate) + ' (sesuai kertas, termasuk catatan jadwal ulang bila ada)'); }
      else if ($('rmDate').value !== firstDate) notes.push('Tanggal di kertas ' + longDate(firstDate) + ' berbeda dengan tanggal yang sudah dipilih; tanggal tidak diubah');
    }
    var ok = parsedList.length, failed = total - ok;
    var head = ok ? ok + ' dari ' + total + ' kertas terbaca' + (secs ? ' dalam ' + secs + ' dtk' : '') + '. ' : 'Scan gagal. ';
    if (!ok && errMsg) head += errMsg + ' ';
    else if (failed) head += failed + ' gagal dibaca. ';
    scanStatus(head + (notes.length ? notes.join('; ') + '. ' : (ok ? 'Data utama terdeteksi. ' : '')) + (ok ? 'Periksa kembali sebelum Kirim WA + Simpan.' : 'Periksa teksnya atau isi manual.'), failed > 0 || anyMiss || !ok);
    if (lastRow) lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ===== Baca teks hasil scan bawaan HP (tanpa AI, tanpa biaya) =====
  function editDist1(a, b) {
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
  }
  function matchDoctorText(value) {
    var hit = normalizeAIDoctor(value); if (hit) return hit;
    var tokens = String(value || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (t) { return t.length >= 5; });
    var names = Object.keys(DOKTER);
    for (var i = 0; i < names.length; i++) {
      var key = names[i].toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-z]/g, '');
      if (key.length >= 5 && tokens.some(function (t) { return editDist1(t, key); })) return names[i];
    }
    return '';
  }
  var LABEL_RE = /^(tgl\.?\s*daftar|tanggal\s*daftar|nama\s*pasien|tanggal\s*lahir|tgl\.?\s*lahir|no\.?\s*hp|no\.?\s*telp|hari|usg\s*(&|dan)|dokter\s*(radiologi|pengirim)|radiolog)/i;
  function isoDate(d, m, y) {
    d = +d; m = +m; y = +y; if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return '';
    var k = y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
    var t = new Date(k + 'T00:00:00'); return t.getMonth() + 1 === m && t.getDate() === d ? k : '';
  }
  function parseOneScan(chunk) {
    var lines = chunk.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    function after(re) {
      for (var i = 0; i < lines.length; i++) if (re.test(lines[i])) {
        var rest = lines[i].replace(re, '').replace(/^[\s:.\-]+/, '').replace(/^(&\s*no\.?\s*rm|pasien|pemeriksaan|radiologi|pengirim|diagnosa|lahir|hp)\s*[:.]?\s*/i, '').trim();
        if (rest) return rest;
        for (var j = i + 1; j < lines.length; j++) if (!LABEL_RE.test(lines[j])) return lines[j];
      }
      return '';
    }
    // nama: teks sebelum "(No. RM)"
    var nama = '', m;
    for (var i = 0; i < lines.length && !nama; i++) if ((m = lines[i].match(/^(.*?)\s*[(\[]\s*\d{4,8}\s*[)\]]/)) && /[a-z]{3}/i.test(m[1]) && !LABEL_RE.test(m[1])) nama = m[1];
    if (!nama) nama = after(/nama\s*pasien(\s*&\s*no\.?\s*rm)?/i).replace(/[(\[].*$/, '').replace(/\d+/g, '');
    nama = nama.replace(/[^A-Za-z.'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
    // nomor HP
    var wa = '', hp = after(/no\.?\s*(hp|telp\w*|wa)/i), cand = hp || chunk;
    var phoneRe = /(?:\+?62|0)\s*8[\d\s.\-]{7,16}\d/, pm = phoneRe.test(hp) ? hp.match(phoneRe) : chunk.match(phoneRe);
    if (pm) wa = pm[0].replace(/[^\d+]/g, '');
    if (wa && !/^(?:\+?62|0|8)\d{7,14}$/.test(wa)) wa = '';
    // jenis USG
    var jenis = normalizeAIExam(after(/usg\s*(&|dan)\s*diagnos\w*/i));
    for (var q = 0; q < lines.length && !jenis; q++) if (!/^usg\s*(&|dan)/i.test(lines[q])) jenis = normalizeAIExam(lines[q]);
    // dokter radiologi (bukan pengirim)
    var dokter = matchDoctorText(after(/dokter\s*radiolog\w*/i));
    if (!dokter) for (var k = 0; k < lines.length && !dokter; k++) if (!/pengirim/i.test(lines[k]) && !/pengirim/i.test(lines[k - 1] || '')) dokter = matchDoctorText(lines[k]);
    // tanggal pemeriksaan + catatan jadwal ulang
    var yearNow = new Date().getFullYear(), tgl = '', exam = after(/(hari\s*\/?\s*)?tgl\.?\s*pemeriksaan|hari\s*\/\s*tgl\.?\s*pemeriksaan/i);
    var dateRe = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(20\d{2})/, dm = dateRe.test(exam) ? exam.match(dateRe) : chunk.match(dateRe);
    if (dm) tgl = isoDate(dm[1], dm[2], dm[3]);
    var catatan = '', rs = null;
    for (var n = 0; n < lines.length && !rs; n++) {
      var r = lines[n].match(/\b(?:ke|jadi|pindah(?:\s*ke)?|resched\w*)\s*[:\-]?\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(20\d{2}|\d{2}))?\b/i);
      if (r) { rs = r; catatan = lines[n]; }
    }
    if (rs) { var ry = rs[3] ? rs[3] : (tgl ? tgl.slice(0, 4) : yearNow); var nd = isoDate(rs[1], rs[2], ry); if (nd) tgl = nd; else catatan = ''; }
    return { nama: nama, wa: wa, jenis: jenis, dokter: dokter, tanggal: tgl, catatan: catatan.replace(/[^\w\s\/.\-,]/g, '').slice(0, 140) };
  }
  function parseScanText(text) {
    var raw = String(text || '').replace(/\r/g, '');
    var parts = raw.split(/(?=radiolog\w*\s*rs\s*setia)/i).filter(function (p) { return p.trim(); });
    if (!parts.length) parts = [raw];
    return parts.map(parseOneScan).filter(function (r) { return r.nama || r.wa || r.jenis || r.dokter; });
  }
  function applyScanText() {
    var ta = $('rmScanText'), text = ta.value;
    if (!text.trim()) return scanStatus('Tempel atau scan teks kertas dulu pada kotak di atas.', true);
    var list = parseScanText(text);
    if (!list.length) return scanStatus('Belum ada data pasien yang terbaca dari teks. Pastikan teks memuat label kertas (Nama Pasien, No. HP, dst.) atau coba scan ulang lebih dekat.', true);
    finishScan(list, list.length, 0, '');
    ta.value = ''; // dikosongkan agar tidak terisi dobel bila tombol ditekan lagi
  }

  // Beberapa foto sekaligus dibaca PARALEL, jadi 5 kertas tidak butuh 5x waktu tunggu.
  function applyScanToForm(fileList) {
    if (scanBusy) return scanStatus('Scan sebelumnya masih berjalan, tunggu sebentar.', true);
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return f && /^image\//.test(f.type); });
    if (!files.length) return scanStatus('Pilih file gambar kertas pasien.', true);
    if (files.some(function (f) { return f.size > 15 * 1024 * 1024; })) return scanStatus('Ukuran foto maksimal 15 MB per foto. Kompres atau foto ulang.', true);
    if (files.length > 10) files = files.slice(0, 10);
    scanBusy = true;
    var t0 = Date.now(), done = 0;
    function tick() { scanStatus('Membaca ' + files.length + ' foto dengan AI… ' + done + '/' + files.length + ' selesai · ' + Math.round((Date.now() - t0) / 1000) + ' dtk'); }
    tick(); var timer = setInterval(tick, 1000);
    Promise.all(files.map(function (f) {
      return requestAIReading(f).then(function (parsed) { done++; return { ok: true, parsed: parsed }; },
        function (err) { done++; return { ok: false, err: err }; });
    })).then(function (results) {
      clearInterval(timer); scanBusy = false;
      var okList = results.filter(function (r) { return r.ok; });
      var firstErr = results.filter(function (r) { return !r.ok; })[0];
      finishScan(okList.map(function (r) { return r.parsed; }), results.length, Math.round((Date.now() - t0) / 1000), firstErr && firstErr.err ? firstErr.err.message : '');
    });
  }

  function init() {
    if (!$('reminderApp')) return;
    shell(); render();
    $('rmForm').addEventListener('submit', function (e) { e.preventDefault(); });
    ['rmScanFile', 'rmScanCam'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function (e) { var fl = e.target.files; if (fl && fl.length) applyScanToForm(Array.prototype.slice.call(fl)); e.target.value = ''; }); });
    $('rmScanParse').addEventListener('click', applyScanText);
    $('rmScanTextClear').addEventListener('click', function () { $('rmScanText').value = ''; scanStatus('', false); });
    $('rmRows').addEventListener('click', function (e) { var b = e.target.closest('[data-row-send]'); if (b) saveOneRow(b.closest('.rm-row')); });
    $('rmForm').addEventListener('click', function (e) {
      var doctor = e.target.closest('[data-apply-doctor]');
      var payer = e.target.closest('[data-apply-payer]');
      if (doctor) applyBulkValue('.rd', $('rmBulkDoctor').value, 'Dokter');
      if (payer) applyBulkValue('.rp', $('rmBulkPayer').value, 'Penjamin');
    });
    $('rmForm').addEventListener('input', function (e) { e.target.classList && e.target.classList.remove('is-missing'); });
    $('rmForm').addEventListener('change', function (e) { e.target.classList && e.target.classList.remove('is-missing'); });
    $('rmAdd').addEventListener('click', function () { addRows(1); });
    $('rmClearAll').addEventListener('click', clearAllRows);
    $('rmDate').addEventListener('input', updateSendState); $('rmDate').addEventListener('change', updateSendState);
    $('rmAdd5').addEventListener('click', function () { addRows(5); });
    $('rmRows').addEventListener('click', function (e) {
      var x = e.target.closest('[data-rm]'); if (!x) return;
      var row = x.closest('.rm-row'), rows = document.querySelectorAll('#rmRows .rm-row');
      if (rows.length > MINROWS) { var vals = readRows(); vals.splice(Array.prototype.indexOf.call(rows, row), 1); renderRows(vals); updateSendState(); }
      else { row.querySelectorAll('input,select').forEach(function (i) { i.value = ''; }); row.removeAttribute('data-pid'); row.classList.remove('is-bad', 'is-sent'); }
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
      render(); updateSendState();
    }).observe(v, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
