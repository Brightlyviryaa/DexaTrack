> Authentication/users implementation update (2026-11-17): the target SQL below predates session integration. Current Prisma schemas/migrations are authoritative. Auth now also owns approval, syncing, archivedAt, nullable passwordHash/employeeId, sessions, email_tokens, identity_lock, and user_operations. Employees has a nullable unique account_id for idempotent service provisioning. Login/profile email changes are coordinated through service contracts; see README for recovery. Workforce schema/design below remains a future backend scope.

# Analisis proyek dan rancangan database MySQL

Status: **rancangan awal**. Schema Prisma dan migrasi sekarang berada di direktori masing-masing service; lihat README untuk penerapan dan baseline. SQL di bawah menggambarkan target desain, bukan migrasi yang harus dijalankan langsung. Implementasi mempertahankan kolom absensi lama demi kompatibilitas dan memakai `@updatedAt` Prisma; SQL rancangan di bawah tidak identik dengan migrasi aktual. Jangan jalankan SQL rancangan ini pada database yang sudah berisi data. Gunakan MySQL 8.0.16 atau lebih baru agar `CHECK` ditegakkan; gunakan InnoDB dan `utf8mb4`.

## Kondisi aplikasi

- Web React/Vite memanggil HTTP gateway; gateway berkomunikasi dengan tiga NestJS service melalui TCP. Gateway tidak memiliki database.
- Auth memiliki `accounts`; employees memiliki `employees`; attendance memiliki `attendances`. Masing-masing sudah menggunakan Prisma dan database MySQL sendiri. Pada saat analisis awal belum ada file migrasi; migrasi sekarang tersedia di direktori Prisma tiap service.
- Backend baru menyediakan health dan daftar karyawan aktif serta maksimal 100 absensi. Login, otorisasi, penulisan data, foto, serta validasi lintas service belum tersedia. Endpoint daftar belum dilindungi.
- CRUD karyawan, lokasi kerja, check-in/out, progres, permohonan dan review HR berjalan dalam memori browser dan hilang saat refresh/logout. Ringkasan dashboard dan laporan menggunakan data contoh terpisah; bukan laporan database.
- Demo memakai satu lokasi bersama, tanggal kerja WIB, satu pasangan absensi per hari, selfie/GPS per kejadian, dan koreksi waktu dengan riwayat. Cuti/sakit/izin hanya mengubah status pengajuan, tanpa saldo cuti atau perubahan otomatis pada absensi. Ini dasar rancangan, bukan klaim kebutuhan produksi yang sudah disepakati.

## Pembagian kepemilikan

| Database/service | Data yang dimiliki | Referensi luar |
| --- | --- | --- |
| `dexatrack_auth` | akun, hash password, role dan status akun | `employee_id` ke employees melalui kontrak service |
| `dexatrack_employees` | identitas dan profil karyawan | tidak ada |
| `dexatrack_attendance` | lokasi, absensi, bukti, pengajuan, keputusan dan audit koreksi | `employee_id` dan `reviewer_account_id` melalui kontrak service |
| API gateway / web | tidak menyimpan data domain | memanggil service melalui gateway |

ID antardatabase sengaja tidak diberi foreign key; service pemilik harus memvalidasi referensi melalui kontrak dan menangani kegagalan/sinkronisasi. `employees.email` adalah email profil, `accounts.email` email login; penyamaan, perubahan, dan penonaktifan keduanya memerlukan alur eksplisit, belum tersedia. Gunakan UTC untuk setiap `DATETIME(3)` dan konversi ke WIB di batas aplikasi; `work_date`, `start_date`, dan `end_date` adalah tanggal kalender WIB, bukan UTC. Koneksi MySQL harus disetel UTC.

## Skema target: auth-service

```sql
-- Jalankan pada database dexatrack_auth yang kosong.
CREATE TABLE accounts (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('EMPLOYEE', 'HR_ADMIN') NOT NULL DEFAULT 'EMPLOYEE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY accounts_employee_id_key (employee_id),
  UNIQUE KEY accounts_email_key (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Satu akun per karyawan mengikuti model saat ini. Hash password harus dibuat dan diverifikasi oleh implementasi auth; skema ini tidak menyediakan sesi atau reset password. Perbandingan email mengikuti collation database; normalisasi email dan mekanisme sinkronisasi harus ditetapkan saat API dibuat.

## Skema target: employees-service

```sql
-- Jalankan pada database dexatrack_employees yang kosong.
CREATE TABLE employees (
  id INT NOT NULL AUTO_INCREMENT,
  employee_no VARCHAR(36) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL,
  department VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY employees_employee_no_key (employee_no),
  UNIQUE KEY employees_email_key (email),
  KEY employees_active_name_idx (is_active, full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`employee_no` diperluas dari 30 menjadi 36 karakter karena UI demo membuat UUID 36 karakter. Tetap berupa nomor publik, berbeda dari `id` numerik. Departemen masih teks sesuai model dan UI; tidak mengasumsikan master organisasi. Penonaktifan lebih aman untuk mempertahankan referensi historis; perilaku penghapusan dan alur sinkronisasi akun perlu diputuskan sebelum implementasi.

## Skema target: attendance-service

```sql
-- Jalankan pada database dexatrack_attendance yang kosong.
CREATE TABLE work_locations (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  radius_meters DECIMAL(10,2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT work_locations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT work_locations_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT work_locations_radius_check CHECK (radius_meters > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Satu baris konfigurasi lokasi aktif. Tidak ada baris berarti belum disetel.
CREATE TABLE attendance_settings (
  id TINYINT NOT NULL DEFAULT 1,
  work_location_id INT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT attendance_settings_singleton_check CHECK (id = 1),
  CONSTRAINT attendance_settings_location_fk FOREIGN KEY (work_location_id) REFERENCES work_locations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendances (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  work_date DATE NOT NULL,
  check_in_at DATETIME(3) NULL,
  check_out_at DATETIME(3) NULL,
  progress_json JSON NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY attendances_employee_date_key (employee_id, work_date),
  KEY attendances_date_idx (work_date),
  CONSTRAINT attendances_times_check CHECK (check_out_at IS NULL OR (check_in_at IS NOT NULL AND check_out_at > check_in_at)),
  CONSTRAINT attendances_version_check CHECK (version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_evidence (
  id INT NOT NULL AUTO_INCREMENT,
  attendance_id INT NOT NULL,
  event_type ENUM('CHECK_IN', 'CHECK_OUT') NOT NULL,
  photo_key VARCHAR(512) NOT NULL,
  captured_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NOT NULL,
  position_at DATETIME(3) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  accuracy_meters DECIMAL(10,2) NOT NULL,
  distance_meters DECIMAL(10,2) NOT NULL,
  location_name VARCHAR(150) NOT NULL,
  location_latitude DECIMAL(9,6) NOT NULL,
  location_longitude DECIMAL(9,6) NOT NULL,
  location_radius_meters DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY attendance_evidence_event_key (attendance_id, event_type),
  CONSTRAINT attendance_evidence_attendance_fk FOREIGN KEY (attendance_id) REFERENCES attendances (id) ON DELETE RESTRICT,
  CONSTRAINT evidence_latitude_check CHECK (latitude BETWEEN -90 AND 90 AND location_latitude BETWEEN -90 AND 90),
  CONSTRAINT evidence_longitude_check CHECK (longitude BETWEEN -180 AND 180 AND location_longitude BETWEEN -180 AND 180),
  CONSTRAINT evidence_distance_check CHECK (accuracy_meters >= 0 AND distance_meters >= 0 AND location_radius_meters > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE requests (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  type ENUM('LEAVE', 'SICK', 'PERMISSION', 'ATTENDANCE_CORRECTION') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  proposed_check_in_at DATETIME(3) NULL,
  proposed_check_out_at DATETIME(3) NULL,
  base_version INT NULL,
  reviewer_account_id INT NULL,
  decided_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- NULL untuk selain koreksi pending: MySQL memperbolehkan beberapa NULL pada unique key.
  pending_correction_date DATE GENERATED ALWAYS AS
    (CASE WHEN type = 'ATTENDANCE_CORRECTION' AND status = 'PENDING' THEN start_date ELSE NULL END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY requests_pending_correction_key (employee_id, pending_correction_date),
  KEY requests_employee_date_idx (employee_id, start_date),
  KEY requests_status_created_idx (status, created_at),
  CONSTRAINT requests_date_check CHECK (end_date >= start_date),
  CONSTRAINT requests_correction_check CHECK (
    (type = 'ATTENDANCE_CORRECTION' AND start_date = end_date AND base_version IS NOT NULL AND base_version >= 0 AND (proposed_check_in_at IS NOT NULL OR proposed_check_out_at IS NOT NULL)) OR
    (type <> 'ATTENDANCE_CORRECTION' AND base_version IS NULL AND proposed_check_in_at IS NULL AND proposed_check_out_at IS NULL)
  ),
  CONSTRAINT requests_decision_check CHECK (
    (status = 'PENDING' AND reviewer_account_id IS NULL AND decided_at IS NULL) OR
    (status IN ('APPROVED', 'REJECTED') AND reviewer_account_id IS NOT NULL AND decided_at IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_corrections (
  id INT NOT NULL AUTO_INCREMENT,
  attendance_id INT NOT NULL,
  request_id INT NOT NULL,
  before_check_in_at DATETIME(3) NULL,
  before_check_out_at DATETIME(3) NULL,
  after_check_in_at DATETIME(3) NOT NULL,
  after_check_out_at DATETIME(3) NULL,
  reason VARCHAR(2000) NOT NULL,
  reviewer_account_id INT NOT NULL,
  decided_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY attendance_corrections_request_key (request_id),
  KEY attendance_corrections_attendance_idx (attendance_id, decided_at),
  CONSTRAINT attendance_corrections_attendance_fk FOREIGN KEY (attendance_id) REFERENCES attendances (id) ON DELETE RESTRICT,
  CONSTRAINT attendance_corrections_request_fk FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE RESTRICT,
  CONSTRAINT corrections_after_times_check CHECK (after_check_out_at IS NULL OR after_check_out_at > after_check_in_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`photo_key` adalah kunci objek privat, bukan foto base64 atau URL publik permanen. Penyimpanan objek, akses, retensi, dan penghapusan foto/GPS belum diimplementasikan atau diputuskan. Snapshot lokasi pada bukti mempertahankan kondisi saat submit meskipun lokasi kerja berubah. Bukti hanya ada jika benar-benar diambil; koreksi tidak membuat bukti palsu. Progres adalah JSON Tiptap yang tervalidasi di backend, maksimal 10.000 karakter teks sesuai demo.

`check_in_at` dan `check_out_at` adalah waktu efektif setelah koreksi; `attendance_evidence` mempertahankan waktu dan bukti asli, sedangkan `attendance_corrections` menyimpan nilai sebelum/sesudah. `base_version = 0` berarti belum ada absensi saat pengajuan dibuat. Waktu usulan kosong berarti mempertahankan waktu efektif yang ada. Nama dan departemen tidak diduplikasi pada pengajuan; tampilkan lewat kontrak employees, dengan kebijakan jika data karyawan tidak tersedia. ID reviewer mengacu ke akun, bukan nama tampilan.

## Aturan yang harus ditegakkan service

- Jalankan otentikasi dan otorisasi di gateway/service sebelum menyediakan endpoint; role picker dan validasi browser bukan kontrol keamanan. Validasi karyawan aktif melalui employees-service dan identitas reviewer melalui auth-service.
- Validasi koordinat, waktu GPS, akurasi, jarak, tanggal WIB, foto dan progres di backend. GPS/selfie dari browser tidak membuktikan identitas atau mencegah pemalsuan. Simpan bukti check-in/out dan ubah absensi dalam transaksi; tangani kegagalan upload objek dan pembersihan objek yatim.
- Dalam satu transaksi attendance, kunci pengajuan dan absensi, cek status pending dan `base_version`, hitung waktu usulan, validasi urutan/tidak di masa depan, tingkatkan versi, catat audit dan keputusan. Jika belum ada baris absensi, gunakan unique `(employee_id, work_date)` untuk mendeteksi konflik dan tangani retry; jangan menimpa data yang dibuat bersamaan. Database unique membatasi satu koreksi pending per karyawan/tanggal.
- Status pengajuan bukan status kehadiran. Tampilan tepat waktu/terlambat demo menggunakan batas 08.00 WIB; aturan jam kerja, hari libur, ketidakhadiran, dan kebijakan laporan belum dimodelkan sebagai kebijakan produksi. Jangan menghitung tidak hadir hanya dari tidak adanya baris tanpa kalender dan kebijakan yang disepakati.
- Audit koreksi bersifat append-only pada lapisan service dan akses database; `CHECK`/FK saja tidak membuatnya immutable. Simpan waktu keputusan, reviewer, alasan dan before/after secara konsisten dalam transaksi.

## Selisih dari implementasi dan rencana migrasi

Skema Prisma sekarang berbeda dari target: `employees.employee_no` panjang 30, sedangkan frontend membuat UUID; `attendances` lama memiliki `submitted_at`, `photo_url`, `notes`, dan status `SUBMITTED/APPROVED/REJECTED`, tanpa konsep check-in/out. Kolom lama tidak dapat dipetakan otomatis ke bukti atau status pengajuan tanpa keputusan bisnis dan asal data. Jangan menghapus atau menafsirkan ulang kolom tersebut secara diam-diam. Existing API `attendance.list` juga mengurutkan berdasarkan `submittedAt`, sehingga perubahan model perlu disertai perubahan kontrak dan pemanggil.

Sebelum menerapkan: inventarisasi database aktual dan riwayat migrasinya; backup dan uji restore; sepakati pemetaan data lama, identitas akun serta kebijakan yang belum diputuskan; terjemahkan target ke Prisma per service; buat migrasi service-spesifik dan generate client sesuai README. Untuk database yang sudah ada tanpa riwayat migrasi, tentukan baseline Prisma berdasarkan skema aktual sebelum migrasi, lalu uji pada salinan data. Gunakan migrasi bertahap/backfill dan verifikasi sebelum penghapusan kolom; jangan menjalankan `migrate dev --name init` secara membabi buta pada data yang sudah ada. Implementasi service, upload foto, keamanan, migrasi data, dan integrasi UI adalah pekerjaan terpisah dari rancangan ini.
