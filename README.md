# DexaTrack

Bootstrap aplikasi absensi WFH. Frontend React/Vite berkomunikasi dengan NestJS API gateway; gateway meneruskan permintaan melalui TCP ke proses NestJS yang terpisah.

- `apps/web`: React, TypeScript, Tailwind.
- `apps/api-gateway`: HTTP API dan TCP clients.
- `apps/auth-service`: pemilik akun, kredensial dan peran; login dan manajemen sesi belum diimplementasikan.
- `apps/employees-service`: pemilik data karyawan dan Prisma schema sendiri.
- `apps/attendance-service`: pemilik data absensi dan Prisma schema sendiri. Absensi menyimpan ID karyawan tanpa foreign key lintas database.

## Warna brand

Token Tailwind di `apps/web/src/styles.css` mengikuti palet DexaTrack: `brand-primary` (`#0F766E`), `brand-tosca` (`#14B8A6`), `brand-light` (`#99E2D7`), dan `brand-surface` (`#E8F7F5`). Gunakan utility seperti `bg-brand-surface`, `text-brand-primary`, atau `border-brand-light`. Pastikan pasangan warna teks dan latar tetap mudah dibaca.

## Menjalankan lokal

Butuh Node.js 20.19+ atau 22.12+, npm, dan MySQL. Buat database `dexatrack_auth`, `dexatrack_employees`, dan `dexatrack_attendance`; buat pengguna database yang masing-masing hanya memiliki akses ke database miliknya untuk deployment.

1. Salin `.env.example` menjadi `.env` pada setiap aplikasi backend dan sesuaikan konfigurasi database.
2. Jalankan `npm install`, lalu `npm run db:generate`.
3. Jalankan migrasi masing-masing: `npm run prisma:migrate -w @dexatrack/auth-service -- --name init`, `npm run prisma:migrate -w @dexatrack/employees-service -- --name init`, dan `npm run prisma:migrate -w @dexatrack/attendance-service -- --name init`.
4. Pada terminal terpisah, jalankan `npm run dev:auth`, `npm run dev:employees`, `npm run dev:attendance`, `npm run dev:gateway`, dan `npm run dev:web`.

Gateway tersedia di `http://localhost:3000/api`, frontend di `http://localhost:5173`. Endpoint awal: `/health`, `/health/auth`, `/employees`, `/attendances`. `/health` hanya memeriksa gateway; `/health/auth` memeriksa respons TCP auth-service. TCP service mengikat localhost secara default; untuk deployment terpisah atur host/port pada masing-masing aplikasi dan batasi jaringan internal.

Ini bootstrap: autentikasi dan otorisasi, penulisan data, unggah foto, dan komunikasi validasi karyawan lintas service belum tersedia. Endpoint daftar saat ini belum dilindungi dan hanya untuk pengembangan lokal. Identitas karyawan dalam hasil absensi perlu diambil melalui kontrak service, bukan join database lintas service. Akun menggunakan `employeeId` sebagai referensi tanpa foreign key lintas database. Pembuatan, penonaktifan, dan perubahan email akun/karyawan memerlukan alur sinkronisasi antarlayanan yang belum diimplementasikan. Kredensial dan peran dimiliki auth-service; email profil juga ada pada employees-service. Penyimpanan foto direncanakan sebagai bagian attendance-service dan belum disiapkan.

Jika database employees sudah dibuat dari skema sebelumnya, rencanakan migrasi data akun ke auth sebelum menghapus kolom `password_hash` dan `role`; perubahan skema ini belum disertai migrasi data otomatis.

Konvensi dan perintah validasi frontend dijelaskan di [apps/web/ARCHITECTURE.md](apps/web/ARCHITECTURE.md).
