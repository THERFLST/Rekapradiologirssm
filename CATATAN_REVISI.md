# Catatan Revisi – Laporan Waktu Pelayanan

Versi final modul **Laporan Waktu Pelayanan** (script `service-import.js` v13).

## Perbaikan
1. **Upload PDF membaca seluruh data.** Pembacaan baris PDF kini berdasarkan pola isi per baris
   (nomor, No. RM, nama, No. Registrasi, departemen, pemeriksaan, lima tanggal-jam, dua selisih,
   keterangan), bukan posisi kolom. Header yang terpotong dan nomor yang menyatu dengan No. RM
   tidak lagi membuat baris hilang. Uji dengan LAPORAN AGUSTUS 2026: 489 dari 489 baris terbaca.
2. **Upload Excel membaca seluruh data.** Kolom dicari secara persis lebih dulu, sehingga
   "No Registrasi" tidak lagi salah dikenali sebagai "Waktu Registrasi". Angka serial tanggal
   yang tidak wajar ditolak. Uji dengan file Excel sintetis: 489 dari 489 baris.
3. **Format tanggal M/D/YYYY dibaca benar** (mis. 8/28/2026 = 28 Agustus 2026).
4. **Selisih waktu mengikuti kolom Selisih dari sistem RS** (data tarik), sesuai laporan yang berjalan.
5. **Unduh PDF berfungsi dan lengkap.** PDF berisi semua baris periode (21 halaman untuk 489 baris).
   Setelah PDF dibuat, muncul tautan "Klik di sini untuk mengunduh PDF" sebagai cadangan
   jika unduhan otomatis diblokir browser. Pada iOS, PDF tetap dibuka di tab baru.

6. **Baris PDF yang terpotong** (nama atau departemen yang turun ke baris berikutnya) digabung kembali.
8. **Nama kolom Excel yang berbeda tetap dikenali** (mis. "Pemeriksaan Radiologi", "Departemen Asal").
7. **Baris yang gagal dibaca dihitung.** Jika ada baris yang tampak seperti data tetapi tidak
   terbaca, status akan menampilkan peringatan jumlahnya, supaya laporan tidak tampak lengkap padahal tidak.

9. **Periode otomatis.** Jika periode belum dipilih, sistem memakai bulan terbanyak di file.
   Jika periode yang dipilih tidak punya data, pesan menyebut bulan yang tersedia di file.
10. **Tanggal kosong dilaporkan.** Jika baris tidak punya tanggal yang terbaca (sering terjadi pada
    file berisi rumus yang disimpan tanpa nilai), pesan meminta file disimpan ulang di Excel.

## Cara memasang
Ganti `service-import.js` dan `index.html` (versi script `v13`) di proyek, atau pakai seluruh
proyek dari paket ini. `service-import.css` berisi gaya tautan cadangan.

## Batasan
- Periode laporan mengikuti tanggal registrasi. Data dengan tanggal registrasi di bulan lain
  tidak ikut dalam laporan bulan tersebut.
- File hasil scan atau foto (PDF gambar) belum didukung.
- Peringatan konsol "units width could not fit page" berasal dari pustaka jsPDF. Hasil PDF
  sudah diperiksa: semua kolom dan teks berada dalam halaman.
