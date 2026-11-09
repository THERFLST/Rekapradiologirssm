# Panduan migrasi ke versi aman untuk internet

Dokumen ini menjelaskan langkah nyata untuk mengubah prototype lokal menjadi aplikasi yang aman dipakai untuk akses internet, dengan data pasien yang disimpan di database dan hanya satu admin yang bisa mengakses.

## 1. Tujuan sistem yang aman

Target akhir:

- aplikasi dapat dibuka di internet
- hanya satu akun admin yang bisa masuk
- data disimpan di database, bukan browser localStorage
- input data disimpan dan dapat dibuka kembali untuk bulan sebelumnya
- sistem punya audit trail perubahan dan penguncian bulan

## 2. Stack yang disarankan

- Frontend: React + Vite
- Auth: Supabase Auth
- Database: Supabase PostgreSQL
- Hosting frontend: Vercel
- Environment variables: `.env.local`, Vercel env vars
- Security: Row Level Security (RLS) pada tabel database

## 3. Aturan akses

- hanya admin yang bisa login dengan akun terdaftar
- akun petugas hanya untuk input data jika memang dibutuhkan
- admin dapat mengunci bulan agar tidak bisa diubah
- semua perubahan harus direkam ke log aktivitas
- data pasien harus berupa agregat (jumlah), bukan identitas pasien

## 4. Struktur tabel utama

### `users`

```sql
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'petugas',
  created_at timestamptz not null default now()
);
```

### `records`

```sql
create table public.records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  source jsonb not null default '{}',
  payer jsonb not null default '{}',
  exams jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `activity_log`

```sql
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);
```

### `month_locks`

```sql
create table public.month_locks (
  month_key text primary key,
  locked boolean not null default false,
  locked_by uuid references public.users(id),
  locked_at timestamptz
);
```

## 5. RLS policy

Contoh policy dasar:

```sql
alter table public.records enable row level security;

create policy "Admin and staff can read their records"
on public.records for select
using (auth.role() = 'authenticated');

create policy "Only admin can update records"
on public.records for update
using (auth.uid() is not null);
```

Untuk produksi, sesuaikan dengan role admin dan petugas agar hanya user yang berhak yang bisa mengubah data.

## 6. Langkah implementasi

### Tahap 1: Migrasi data lokal ke database

- ambil data dari `localStorage`
- transform ke format JSON yang konsisten
- insert ke tabel `records`
- lakukan validasi di server agar tidak masuk data invalid

### Tahap 2: Login berbasis Supabase

- beri satu akun admin utama
- amankan password dengan auth provider Supabase
- jangan menaruh password di frontend atau repo

### Tahap 3: Proteksi halaman

- halaman aplikasi hanya muncul jika session valid
- jika session tidak valid, redirect ke login page
- bila bulan terkunci, form input dinonaktifkan kecuali admin

### Tahap 4: Log aktivitas

Setiap simpan/edit/hapus data harus menulis entri ke `activity_log`.

### Tahap 5: Deployment aman

- simpan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di environment variable
- deploy frontend ke Vercel
- set cors dan domain whitelist sesuai kebutuhan
- aktifkan HTTPS secara otomatis

## 7. Checklist sebelum production

- [ ] semua data pindah ke database
- [ ] hanya satu admin aktif
- [ ] password tidak tertulis di kode
- [ ] login aman via Supabase Auth
- [ ] RLS aktif
- [ ] backup otomatis aktif
- [ ] log aktivitas berfungsi
- [ ] bulan bisa dikunci oleh admin
- [ ] semua export Excel/PDF sudah diuji

## 8. Catatan penting

Walaupun aplikasi hanya mencatat jumlah agregat, tetap perlu memperhatikan kebijakan keamanan data klinis dan privasi rumah sakit. Data pasien dalam format rekam medis tetap harus dijaga kerahasiaannya.

Langkah berikutnya yang paling penting adalah memindahkan data dari browser ke database, lalu menyiapkan proteksi login dan role-based access yang benar.
