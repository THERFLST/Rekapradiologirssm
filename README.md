# Rekap Pasien Radiologi

Aplikasi web sederhana berbahasa Indonesia untuk mencatat **jumlah** pasien dan pemeriksaan harian Instalasi Radiologi RS Setia Mitra serta menghitung rekap bulanan. Aplikasi tidak meminta nama pasien atau nomor rekam medis.

## Versi dasar saat ini

- Pemilih bulan dan tahun; jumlah hari dan nama hari mengikuti kalender.
- Form input harian untuk asal pasien, penjamin, dan 23 jenis pemeriksaan.
- Tampilan tabel bulanan yang dapat dipilih untuk membuka formulir tanggal.
- Perhitungan otomatis kunjungan, pemeriksaan, ekspose, persentase, subtotal, dan grand total.
- Validasi kesesuaian asal pasien dengan penjamin, bilangan bulat nonnegatif, serta ekspose yang tidak kurang dari pasien.
- Penandaan hari Minggu dan daftar tanggal yang perlu diperiksa.
- Penyimpanan otomatis pada `localStorage` browser.

## Menjalankan

Tidak memerlukan proses build atau dependensi. Buka `index.html` langsung di browser, atau jalankan server statis lokal, misalnya:

```sh
python -m http.server 8000
```

Lalu buka `http://localhost:8000`.

## Batasan keamanan dan penyimpanan

Versi dasar ini **belum memiliki login, database server, sinkronisasi antarperangkat, maupun backup otomatis**. Data hanya ada di browser/perangkat tempat data dimasukkan; menghapus data situs atau mengganti perangkat dapat menghilangkannya. GitHub Pages hanya menyajikan file web dan tidak menyediakan penyimpanan database privat.

Jangan gunakan versi ini untuk data pasien yang dapat mengidentifikasi seseorang atau untuk operasional klinis sebelum autentikasi dan penyimpanan server yang sesuai disiapkan dan ditinjau. Walaupun aplikasi ini hanya mencatat jumlah agregat, pengguna tetap perlu mengikuti kebijakan privasi dan keamanan data rumah sakit. Tahap selanjutnya yang direncanakan: database dan autentikasi, lalu ekspor/grafik serta penguncian bulan sesuai kebutuhan.
