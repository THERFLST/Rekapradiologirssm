# Rekap Pasien Radiologi

MVP front-end untuk rekap agregat Instalasi Radiologi RS Setia Mitra.

## Jalankan

Buka `index.html` di browser, atau aktifkan GitHub Pages dari Settings → Pages, pilih branch `main` dan folder `/ (root)`. Setelah beberapa menit, GitHub menampilkan URL Pages pada halaman tersebut.

## Fitur saat ini

- Pemilih bulan/tahun dan navigasi tanggal.
- Form input harian yang responsif untuk HP maupun komputer.
- Perhitungan kunjungan, pemeriksaan, ekspose, dan rekap bulanan.
- Validasi kesetaraan asal pasien dengan penjamin (Naker tidak dihitung dua kali) serta ekspose minimal sama dengan pasien.
- Data nol tampil sebagai tanda `-` pada rekap.
- Penyimpanan otomatis dengan `localStorage` browser.

## Batasan penting

Versi ini belum memakai database bersama, login, kontrol akses, audit log, ekspor, atau penguncian bulan. `localStorage` hanya tersimpan di browser/perangkat yang dipakai dan tidak membagikan data antarpetugas. Jangan gunakan untuk data operasional atau masukkan identitas pasien sebelum backend, autentikasi, backup, dan keamanan ditinjau admin IT rumah sakit.
