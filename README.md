# Rekap Pasien Radiologi

Aplikasi web berbahasa Indonesia untuk mencatat jumlah pasien dan pemeriksaan harian Instalasi Radiologi RS Setia Mitra. Aplikasi ini dirancang untuk memudahkan input harian dan rekap bulanan tanpa spreadsheet manual.

## Status saat ini

Versi yang ada sekarang adalah prototype yang sudah mencakup:

- pemilihan bulan dan tahun
- input harian per tanggal
- kategori asal pasien, penjamin, dan jenis pemeriksaan
- perhitungan otomatis kunjungan, pemeriksaan, dan ekspose
- validasi otomatis per hari
- ringkasan bulanan
- penguncian bulan untuk admin
- login demo dengan dua peran: Admin dan Petugas
- ekspor file Excel dan PDF

## Catatan keamanan penting

Versi ini masih memakai penyimpanan localStorage pada browser dan belum siap dipakai untuk data pasien nyata yang diakses lewat internet secara publik.

Untuk produksi yang aman, data pasien tidak boleh disimpan hanya di browser. Arsitektur yang disarankan adalah:

- frontend: Vite + React
- auth: Supabase Auth
- database: Supabase Postgres / Firestore
- deployment frontend: Vercel / Netlify
- access control: hanya satu akun admin yang diizinkan
- row level security: hanya admin yang bisa baca/tulis data
- penyimpanan file: aman di database/server, bukan localStorage

## Alur migrasi ke versi aman untuk internet

1. Gunakan Supabase Auth untuk login satu admin.
2. Simpan semua record rekap ke tabel database, bukan localStorage.
3. Terapkan Row Level Security (RLS) agar hanya user tertentu yang bisa akses.
4. Hapus data demo dan input dummy dari produksi.
5. Pastikan semua secret dan kredensial disimpan di environment variable.
6. Uji akses dari perangkat lain, bukan hanya dari browser lokal.
7. Backup otomatis dan audit log perubahan harian.

## Struktur data yang disarankan

- users
  - id
  - email
  - role
  - created_at
- records
  - id
  - date
  - source values
  - payer values
  - exam values
  - created_at
  - updated_at
- activity_log
  - id
  - user_id
  - action
  - details
  - created_at
- locks
  - month_key
  - locked
  - locked_by
  - locked_at

## Tahap berikutnya yang paling krusial

Tahap berikutnya adalah mengubah prototype lokal menjadi aplikasi yang aman untuk internet:

- migrasi data dari localStorage ke database
- login berbasis email/password dengan autentikasi yang benar
- page protection berdasarkan session/auth
- single-admin policy
- validasi server-side untuk tiap input
- audit trail perubahan
- deployment online yang aman dengan variabel lingkungan

## Menjalankan versi lokal

Buka file `index.html` langsung di browser, atau jalankan server statis lokal:

```bash
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000
```

## Catatan terakhir

Versi lokal ini cocok untuk demo dan pengembangan awal, tetapi bukan untuk produksi data pasien yang bersifat sensitif atau digunakan di jaringan publik tanpa backend yang aman.

Langkah berikut yang paling penting adalah migrasi ke arsitektur berautentikasi dan berbasis database. Setelah itu, aplikasi dapat dipublikasikan secara aman untuk akses internet.
