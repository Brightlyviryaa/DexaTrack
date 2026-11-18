# DexaTrack

Bootstrap aplikasi absensi WFH. Frontend React/Vite berkomunikasi dengan NestJS API gateway; gateway meneruskan permintaan melalui TCP ke proses NestJS yang terpisah.

- `apps/web`: React, TypeScript, Tailwind.
- `apps/api-gateway`: HTTP API dan TCP clients.
- `apps/auth-service`: pemilik akun, kredensial, role, persetujuan, sesi, token email, dan sinkronisasi identitas.
- `apps/employees-service`: pemilik data karyawan dan Prisma schema sendiri.
- `apps/attendance-service`: pemilik data absensi dan Prisma schema sendiri. Absensi menyimpan ID karyawan tanpa foreign key lintas database.

## Warna brand

Token Tailwind di `apps/web/src/styles.css` mengikuti palet DexaTrack: `brand-primary` (`#0F766E`), `brand-tosca` (`#14B8A6`), `brand-light` (`#99E2D7`), dan `brand-surface` (`#E8F7F5`). Gunakan utility seperti `bg-brand-surface`, `text-brand-primary`, atau `border-brand-light`. Pastikan pasangan warna teks dan latar tetap mudah dibaca.

## Menjalankan lokal

Butuh Node.js 20.19+ atau 22.12+, npm, dan MySQL 8.0.16+ (untuk penegakan CHECK constraint). Buat database `dexatrack_auth`, `dexatrack_employees`, dan `dexatrack_attendance`; buat pengguna database yang masing-masing hanya memiliki akses ke database miliknya untuk deployment.

1. Salin `.env.example` menjadi `.env` pada setiap aplikasi backend dan sesuaikan konfigurasi database.
2. Jalankan `npm install`, lalu `npm run db:generate`.
3. Untuk database baru yang kosong, jalankan migrasi yang sudah tersedia: `npm exec -w @dexatrack/auth-service -- prisma migrate deploy`, `npm exec -w @dexatrack/employees-service -- prisma migrate deploy`, dan `npm exec -w @dexatrack/attendance-service -- prisma migrate deploy`. Untuk database yang sudah ada, baca bagian migrasi di bawah sebelum menjalankan perintah.
4. Pada terminal terpisah, jalankan `npm run dev:auth`, `npm run dev:employees`, `npm run dev:attendance`, `npm run dev:gateway`, dan `npm run dev:web`.

Gateway tersedia di `http://localhost:3000/api`, frontend di `http://localhost:5173`. Endpoint awal: `/health`, `/health/auth`, `/employees`, `/attendances`. `/health` hanya memeriksa gateway; `/health/auth` memeriksa respons TCP auth-service. TCP service mengikat localhost secara default; untuk deployment terpisah atur host/port pada masing-masing aplikasi dan batasi jaringan internal.

Backend juga menyediakan `GET /attendance/settings` untuk pengguna yang masuk dan `PUT /attendance/settings` khusus HR. Frontend dan attendance-service memakai lokasi serta jam masuk WIB dari pengaturan ini. Jalankan migrasi attendance yang tersedia sebelum memakai endpoint ini.

Authentication dan pengelolaan akun/karyawan memakai backend. Pendaftaran mandiri menunggu persetujuan HR; akun buatan HR memakai tautan aktivasi email. Absensi, pengajuan, pengaturan lokasi, foto, ringkasan HR, dan laporan HR memakai backend. Tidak ada pemilih mode/identitas: hak akses ditentukan akun yang login.

Jika database employees sudah dibuat dari skema sebelumnya, rencanakan migrasi data akun ke auth sebelum menghapus kolom `password_hash` dan `role`; perubahan skema ini belum disertai migrasi data otomatis.

### Migrasi database yang sudah ada

Setiap service memiliki migrasi `0_init` yang merepresentasikan schema awal di repository, diikuti perubahan workforce untuk employees dan attendance. Jangan jalankan `migrate deploy` langsung pada tabel yang sudah ada tanpa riwayat migrasi. Backup dan uji restore, lalu bandingkan schema **masing-masing database** dengan `0_init/migration.sql` milik service tersebut. Riwayat migrasi atau schema aktual yang berbeda memerlukan rencana migrasi khusus; jangan menandai baseline sebagai applied sebelum cocok.

Hanya setelah database cocok dengan baseline dan belum memiliki riwayat Prisma, tandai baseline masing-masing: `npm exec -w @dexatrack/auth-service -- prisma migrate resolve --applied 0_init`, lalu ulangi untuk `@dexatrack/employees-service` dan `@dexatrack/attendance-service`. Selanjutnya jalankan `prisma migrate deploy` untuk masing-masing seperti di atas. Uji terlebih dahulu pada salinan database, termasuk data dan akses pengguna. Jangan gunakan resolve untuk melewati migrasi yang belum sesuai.

Migrasi attendance mempertahankan kolom lama dan tidak mengubahnya menjadi bukti check-in/out; data lama memerlukan pemetaan terpisah. Kolom `pending_correction_date`, unique index-nya, dan CHECK constraints ditulis di SQL migrasi karena tidak dinyatakan dalam Prisma schema; pertahankan saat membuat migrasi baru dan uji penerapannya di MySQL. `updated_at` dikelola Prisma saat penulisan melalui client; penulis SQL langsung harus memperbaruinya sendiri. Waktu `DATETIME` baru disimpan sebagai UTC, dan tanggal kerja mengikuti Asia/Jakarta.

Konvensi dan perintah validasi frontend dijelaskan di [apps/web/ARCHITECTURE.md](apps/web/ARCHITECTURE.md).

## Authentication dan users

### Infrastruktur lokal

`compose.yaml` menyediakan MySQL 8.4 dan Mailpit, terikat ke loopback. Buat `.env` root dari `.env.example` dan isi `DEXATRACK_DB_PASSWORD` dengan nilai acak. Jalankan `docker compose up -d`, lalu tunggu `docker compose ps` menunjukkan MySQL sehat. Container baru membuat database aplikasi dan dua database khusus integration test. Jangan gunakan kredensial root ini untuk deployment.

Salin `.env.example` setiap backend menjadi `.env` dan sesuaikan `DATABASE_URL` dengan password lokal tersebut. Auth-service juga memerlukan alamat employees-service dan SMTP. Konfigurasi default memakai Mailpit: SMTP `127.0.0.1:1025`, inbox [localhost:8025](http://localhost:8025). SMTP produksi memakai `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, dan `SMTP_FROM`; tetapkan `WEB_ORIGIN` ke origin HTTPS frontend. Mailpit tidak mengirim email ke internet. Jika port default sudah digunakan proyek lain, ubah `DEXATRACK_SMTP_PORT`/`DEXATRACK_MAILPIT_PORT` pada `.env` root dan samakan `SMTP_PORT` pada auth-service. Integration test mengikuti port root tersebut.

Generate client dan deploy migrasi sesuai petunjuk di atas. Untuk database lama, tetap ikuti prosedur baseline; jangan reset. Migrasi auth mempertahankan akun lama sebagai `APPROVED`, tidak mengubah hash password lama menjadi hash scrypt. Akun dengan hash legacy membutuhkan reset melalui HR atau lupa password sebelum dapat login. Migrasi profil menambahkan `account_id` nullable; referensi akun lama ditautkan ketika profil berikutnya disinkronkan.

Jalankan employees-service, auth-service, dan gateway. Buat admin pertama dari terminal interaktif:

```sh
npm run bootstrap -w @dexatrack/auth-service
```

Perintah meminta nama, email, departemen, dan password tersembunyi (12–128 karakter). Tidak ada akun/password bawaan. Bootstrap ditolak jika admin sudah tersedia. Buka frontend untuk login.

### Perilaku

- **Daftar akun:** nama/email/password; role selalu Employee, status menunggu HR. HR menetapkan departemen saat menyetujui. Penolakan disimpan dan dapat ditinjau kembali melalui tombol Setujui.
- **Tambah karyawan oleh HR:** akun disetujui dengan password belum diatur; email berisi tautan aktivasi sekali pakai selama 30 menit. Gunakan Kirim ulang aktivasi bila email gagal/tautan kedaluwarsa.
- **Reset password:** lupa password memberikan pesan generik; HR dapat mengirim tautan dari Karyawan. Akun belum disetujui/nonaktif/arsip tidak memenuhi syarat. Token lama digantikan ketika tautan baru diterbitkan.
- **Sesi:** cookie HttpOnly, SameSite=Lax, berlaku absolut 7 hari. Secure otomatis pada `NODE_ENV=production` atau `COOKIE_SECURE=true`. Logout mencabut sesi saat ini; ubah/reset password mencabut semua sesi. Setiap perubahan data akun oleh HR juga mencabut sesi/token lama.
- **Profil dan akses:** HR dapat mengubah email, nama, departemen, role, status; penghapusan berarti arsip, sehingga referensi historis tetap tersimpan. Akun yang diarsipkan tidak ditampilkan dan emailnya tetap dicadangkan. HR tidak dapat mencabut akses dirinya sendiri atau admin aktif terakhir.
- **Keamanan HTTP:** request perubahan data memerlukan Origin yang sama dengan `WEB_ORIGIN` dan header `X-DexaTrack-Request: 1`; frontend mengaturnya otomatis. CORS hanya origin tersebut. Login/register/token recovery dibatasi per IP per proses gateway. Gunakan shared limiter sebelum menambah replica gateway.

### Kontrak HTTP

Semua request melalui `/api`. Body JSON; error `{ message }` dengan status 400/401/403/404/409/429/503. ID akun (`user.id`) berbeda dari ID profil (`user.employeeId`/`user.profile.id`). Tidak ada hash atau token rahasia dalam respons user. Cookie hanya dipasang gateway; token sesi mentah tidak dikembalikan ke browser sebagai JSON.

| Method/path | Payload / akses |
| --- | --- |
| POST `/auth/register` | `fullName,email,password`; publik; header `Idempotency-Key` UUID |
| POST `/auth/login` | `email,password`; publik |
| GET `/auth/me` | sesi; akun + profil sendiri |
| POST `/auth/logout` | sesi saat ini, idempoten |
| POST `/auth/change-password` | `currentPassword,password`; sesi |
| POST `/auth/forgot-password` | `email`; publik |
| POST `/auth/reset-password`, `/auth/activate` | `token,password`; publik |
| GET `/users`, `/users/:id` | HR; akun/profil, termasuk pending dan nonaktif |
| POST `/users` | `fullName,email,department,role`; HR; Idempotency-Key |
| PATCH `/users/:id` | subset `fullName,email,department,role,isActive`; HR; Idempotency-Key |
| POST `/users/:id/approve` | `department`; HR; Idempotency-Key |
| POST `/users/:id/reject` | HR; Idempotency-Key |
| POST `/users/:id/reset-password` | HR; mengirim ulang aktivasi jika password belum dibuat |
| DELETE `/users/:id` | arsip; HR; Idempotency-Key |

Role API adalah `HR_ADMIN` atau `EMPLOYEE`. Frontend memakai TanStack Query, memeriksa sesi saat dimuat/fokus kembali, dan tidak menganggap error jaringan sebagai logout. User non-HR tidak memuat daftar seluruh karyawan.

### Sinkronisasi dan pemulihan

Auth-service menyimpan intent `user_operations` sebelum memanggil kontrak `employees.sync`; employees-service melakukan upsert idempoten berdasarkan ID akun. Akun bertanda `syncing` tidak dapat login sampai profil berhasil disinkronkan. Transaksi lokal memakai lock identitas untuk serialisasi dan perlindungan admin terakhir; tidak ada join/transaksi lintas database. Request dengan Idempotency-Key yang sama dapat diulang selama operasi itu masih tercatat; setiap akun menyimpan operasi terbaru, jadi kunci ini bukan arsip idempotensi permanen.

Jika service terputus saat provisioning/perubahan profil, pulihkan employees-service lalu jalankan:

```sh
npm run reconcile -w @dexatrack/auth-service
```

Perintah tidak mengirim email; setelah pemulihan, HR dapat mengirim ulang aktivasi/reset. Konflik email profil lama harus ditinjau sebelum rekonsiliasi; jangan menghapus data untuk melewatinya. Kegagalan SMTP tidak menghapus akun yang sudah dibuat. Token kedaluwarsa tidak dapat dipakai; sesi kedaluwarsa dibersihkan saat login berikutnya, token lama diganti saat pengiriman ulang.

### Pengujian

```sh
npm run test -w @dexatrack/auth-service
npm run typecheck -w @dexatrack/web
npm run lint -w @dexatrack/web
npm run test -w @dexatrack/web
npm run build
npm run test:integration -w @dexatrack/auth-service
```

Integration test memerlukan build backend terbaru, Docker MySQL/Mailpit, serta `.env` root lokal. Test menggunakan port 13000/13001/13003, menerapkan migrasi ke **database khusus `dexatrack_auth_test` dan `dexatrack_employees_test`**, dan mengosongkan data kedua database test tersebut. Database aplikasi tidak diubah. Jangan menyimpan data penting di database test. Inbox Mailpit tetap menyimpan pesan test lokal.

## Laporan kehadiran HR

Buka `/laporan` dengan akun HR untuk melihat rekap bulanan dari data yang tersimpan. Gateway menyediakan `GET /api/reports/attendance?period=YYYY-MM&q=...`. Parameter `q` opsional dan mencocokkan nama atau departemen.

Hadir dan Terlambat memakai check-in efektif serta jam masuk yang tersimpan pada catatan. Izin, cuti, dan sakit yang disetujui dihitung per hari kalender dalam periode tersebut sampai hari ini WIB. Setiap karyawan dihitung paling banyak sekali per tanggal. Kolom Tidak hadir menampilkan tanda pisah sampai tersedia kalender kerja.

## Workforce

Masuk dengan akun Employee yang disetujui HR untuk mencoba check-in melalui kamera dan GPS. Data absensi dan pengajuan disimpan oleh attendance-service. HR mengatur lokasi dan jam masuk di Settings.

Kamera/GPS memerlukan HTTPS tepercaya atau localhost serta izin browser. Foto, koordinat, dan progres dikirim saat absensi. Foto disimpan secara privat. Panduan oval tidak mendeteksi wajah dan validasi GPS tidak mencegah pemalsuan. Profil dan daftar karyawan memakai database dan tidak direset oleh refresh.
