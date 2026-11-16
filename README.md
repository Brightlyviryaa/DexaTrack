# DexaTrack

Bootstrap aplikasi absensi WFH. Frontend React/Vite berkomunikasi dengan NestJS API gateway; gateway meneruskan permintaan melalui TCP ke dua proses NestJS yang terpisah.

- `apps/web`: React, TypeScript, Tailwind.
- `apps/api-gateway`: HTTP API dan TCP clients.
- `apps/employees-service`: pemilik data karyawan dan Prisma schema sendiri.
- `apps/attendance-service`: pemilik data absensi dan Prisma schema sendiri. Absensi menyimpan ID karyawan tanpa foreign key lintas database.

## Menjalankan lokal

Butuh Node.js 20.19+ atau 22.12+, npm, dan MySQL. Buat database `dexatrack_employees` dan `dexatrack_attendance`; buat pengguna database yang masing-masing hanya memiliki akses ke database miliknya untuk deployment.

1. Salin `.env.example` menjadi `.env` pada setiap aplikasi backend dan sesuaikan konfigurasi database.
2. Jalankan `npm install`, lalu `npm run db:generate`.
3. Jalankan migrasi masing-masing: `npm run prisma:migrate -w @dexatrack/employees-service -- --name init` dan `npm run prisma:migrate -w @dexatrack/attendance-service -- --name init`.
4. Pada terminal terpisah, jalankan `npm run dev:employees`, `npm run dev:attendance`, `npm run dev:gateway`, dan `npm run dev:web`.

Gateway tersedia di `http://localhost:3000/api`, frontend di `http://localhost:5173`. Endpoint awal: `/health`, `/employees`, `/attendances`. Health hanya memeriksa gateway. TCP service mengikat localhost secara default; untuk deployment terpisah atur host/port pada masing-masing aplikasi dan batasi jaringan internal.

Ini bootstrap: autentikasi dan otorisasi, penulisan data, unggah foto, dan komunikasi validasi karyawan lintas service belum tersedia. Endpoint daftar saat ini belum dilindungi dan hanya untuk pengembangan lokal. Identitas karyawan dalam hasil absensi perlu diambil melalui kontrak service, bukan join database lintas service.
