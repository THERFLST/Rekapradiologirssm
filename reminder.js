/* reminder.js v1 — Reminder USG: catat pasien (nama, WA, tanggal periksa) dan kirim pengingat via WhatsApp hanya pada H-1. */
(function () {
  'use strict';
  var KEY = 'rekap-radiologi-reminder-usg-v1', TKEY = 'rekap-radiologi-reminder-usg-template-v1';
  var DEFAULT_TPL = 'Halo {nama}, kami dari Instalasi Radiologi RS Setia Mitra mengingatkan bahwa jadwal pemeriksaan USG Anda adalah besok, {tanggal}. Mohon hadir tepat waktu. Jika berhalangan, silakan beri tahu kami. Terima kasih.';
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

  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
  function getTpl() { try { return localStorage.getItem(TKEY) || DEFAULT_TPL; } catch (e) { return DEFAULT_TPL; } }
  function setTpl(v) { try { localStorage.setItem(TKEY, v); } catch (e) {} }

  // 0812-3456-7890 / +62 812... / 812... -> 628123456789 (format wa.me)
  function normPhone(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.indexOf('8') === 0) d = '62' + d;
    return /^62\d{8,13}$/.test(d) ? d : '';
  }
  // siap = hari ini adalah H-1; tunggu = H-1 belum tiba; lewat = H-1 sudah terlewat
  function stateOf(p) { var t = todayKey(), h1 = addDays(p.tanggal, -1); return h1 === t ? 'siap' : h1 > t ? 'tunggu' : 'lewat'; }
  function fill(p) { return getTpl().replace(/\{nama\}/g, p.nama).replace(/\{tanggal\}/g, longDate(p.tanggal)); }

  var data = load(), filter = 'semua';

  function shell() {
    $('reminderApp').innerHTML =
      '<div id="rmBanner" class="rm-banner" role="status" aria-live="polite"></div>' +
      '<form id="rmForm" class="rm-form" autocomplete="off">' +
        '<label>Nama pasien<input id="rmNama" type="text" maxlength="80" placeholder="Nama lengkap" required></label>' +
        '<label>No. WhatsApp<input id="rmWa" type="tel" inputmode="tel" placeholder="0812xxxxxxxx" required></label>' +
        '<label>Tanggal pemeriksaan<input id="rmTgl" type="date" required></label>' +
        '<button class="primary-action" type="submit">Simpan Pasien</button>' +
      '</form>' +
      '<p id="rmMsg" class="muted rm-msg" role="status" aria-live="polite"></p>' +
      '<details class="rm-tpl"><summary>Isi pesan reminder</summary>' +
        '<p class="hint">Gunakan {nama} dan {tanggal}; keduanya terisi otomatis untuk tiap pasien.</p>' +
        '<textarea id="rmTpl" rows="4"></textarea>' +
        '<button type="button" id="rmTplReset" class="secondary">Kembalikan bawaan</button>' +
      '</details>' +
      '<div class="rm-listhead"><h3>Data pasien</h3><div class="seg" id="rmFilter">' +
        '<button type="button" data-f="semua" class="on">Semua</button><button type="button" data-f="siap">Perlu dikirim</button><button type="button" data-f="terkirim">Terkirim</button>' +
      '</div></div><div id="rmList" class="rm-list"></div>';
    $('rmTpl').value = getTpl();
    $('rmTgl').min = todayKey();
  }

  function render() {
    var t = todayKey(), tomorrow = addDays(t, 1);
    var due = data.filter(function (p) { return stateOf(p) === 'siap' && p.status !== 'terkirim'; });
    var b = $('rmBanner');
    b.className = 'rm-banner' + (due.length ? ' is-due' : '');
    b.innerHTML = due.length
      ? '<strong>' + due.length + ' pasien perlu dikirimi reminder hari ini</strong><span>Pemeriksaan besok, ' + esc(longDate(tomorrow)) + '</span>'
      : '<strong>Tidak ada reminder yang perlu dikirim hari ini</strong><span>Pasien dengan pemeriksaan besok (' + esc(shortDate(tomorrow)) + ') akan muncul di sini.</span>';

    var rows = data.slice().sort(function (a, c) { return a.tanggal < c.tanggal ? -1 : a.tanggal > c.tanggal ? 1 : a.nama.localeCompare(c.nama); })
      .filter(function (p) {
        if (filter === 'siap') return stateOf(p) === 'siap' && p.status !== 'terkirim';
        if (filter === 'terkirim') return p.status === 'terkirim';
        return true;
      });
    $('rmList').innerHTML = rows.length ? rows.map(item).join('') : '<p class="empty-state">' + (data.length ? 'Tidak ada data pada filter ini.' : 'Belum ada pasien. Isi formulir di atas untuk mencatat pasien pertama.') + '</p>';
    document.querySelectorAll('#rmFilter button').forEach(function (x) { x.classList.toggle('on', x.dataset.f === filter); });
  }

  function item(p) {
    var st = stateOf(p), sent = p.status === 'terkirim', h1 = addDays(p.tanggal, -1);
    var chip = sent ? '<span class="st is-ok">\u2713 Terkirim</span>'
      : st === 'siap' ? '<span class="st rm-ready">Siap dikirim</span>'
      : st === 'tunggu' ? '<span class="st">Bisa dikirim ' + esc(shortDate(h1)) + '</span>'
      : '<span class="st is-bad">Terlewat</span>';
    var can = st === 'siap';
    var tip = can ? '' : ' disabled title="Hanya bisa dikirim H-1 (' + esc(longDate(h1)) + ')"';
    return '<article class="rm-item' + (can && !sent ? ' is-due' : '') + '">' +
      '<div class="rm-main"><strong>' + esc(p.nama) + '</strong><span>+' + esc(p.wa) + '</span><small>Periksa: ' + esc(longDate(p.tanggal)) + '</small></div>' +
      '<div class="rm-side">' + chip + '<div class="rm-actions">' +
        '<button type="button" class="primary-action" data-act="send" data-id="' + esc(p.id) + '"' + tip + '>' + (sent ? 'Kirim ulang' : 'Kirim WA') + '</button>' +
        '<button type="button" class="danger" data-act="del" data-id="' + esc(p.id) + '">Hapus</button>' +
      '</div></div></article>';
  }

  function say(text, bad) { var m = $('rmMsg'); m.textContent = text; m.classList.toggle('bad', !!bad); }

  function onSubmit(e) {
    e.preventDefault();
    var nama = $('rmNama').value.trim(), wa = normPhone($('rmWa').value), tgl = $('rmTgl').value;
    if (!nama) return say('Nama pasien wajib diisi.', true);
    if (!wa) return say('Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxxx.', true);
    if (!tgl) return say('Tanggal pemeriksaan wajib diisi.', true);
    if (tgl < todayKey()) return say('Tanggal pemeriksaan tidak boleh sudah lewat.', true);
    if (data.some(function (p) { return p.wa === wa && p.tanggal === tgl; })) return say('Pasien dengan nomor dan tanggal ini sudah tercatat.', true);
    data.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nama: nama, wa: wa, tanggal: tgl, status: 'belum', dibuat: new Date().toISOString() });
    if (!save(data)) say('Gagal menyimpan: ruang browser penuh.', true);
    else say(nama + ' tersimpan. ' + (addDays(tgl, -1) === todayKey() ? 'Pemeriksaan besok, reminder bisa dikirim sekarang.' : 'Reminder bisa dikirim pada ' + longDate(addDays(tgl, -1)) + '.'));
    $('rmNama').value = ''; $('rmWa').value = ''; $('rmNama').focus();
    render();
  }

  function onListClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var p = data.filter(function (x) { return x.id === btn.dataset.id; })[0];
    if (!p) return;
    if (btn.dataset.act === 'del') {
      if (!confirm('Hapus ' + p.nama + ' dari daftar reminder?')) return;
      data = data.filter(function (x) { return x !== p; }); save(data); render(); return;
    }
    if (stateOf(p) !== 'siap') return say('Reminder hanya bisa dikirim pada H-1.', true);
    window.open('https://wa.me/' + p.wa + '?text=' + encodeURIComponent(fill(p)), '_blank', 'noopener');
    p.status = 'terkirim'; p.dikirim = new Date().toISOString(); save(data);
    say('WhatsApp dibuka untuk ' + p.nama + '. Tekan tombol kirim di WhatsApp untuk menyelesaikan.');
    render();
  }

  function init() {
    if (!$('reminderApp')) return;
    shell(); render();
    $('rmForm').addEventListener('submit', onSubmit);
    $('rmList').addEventListener('click', onListClick);
    $('rmFilter').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });
    $('rmTpl').addEventListener('input', function (e) { setTpl(e.target.value); });
    $('rmTplReset').addEventListener('click', function () { $('rmTpl').value = DEFAULT_TPL; setTpl(DEFAULT_TPL); });
    // segarkan status H-1 setiap modul dibuka (mis. tab dibiarkan terbuka semalaman)
    var v = $('v-reminder');
    if (v) new MutationObserver(function () { if (!v.hidden) { $('rmTgl').min = todayKey(); render(); } }).observe(v, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
