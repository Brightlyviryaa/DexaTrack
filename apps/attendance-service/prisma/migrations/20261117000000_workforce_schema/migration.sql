-- AlterTable
ALTER TABLE `attendances` ADD COLUMN `check_in_at` DATETIME(3) NULL,
    ADD COLUMN `check_out_at` DATETIME(3) NULL,
    ADD COLUMN `progress_json` JSON NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
    MODIFY `photo_url` VARCHAR(2048) NULL;

-- CreateTable
CREATE TABLE `work_locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `radius_meters` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_settings` (
    `id` TINYINT NOT NULL DEFAULT 1,
    `work_location_id` INTEGER NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_evidence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attendance_id` INTEGER NOT NULL,
    `event_type` ENUM('CHECK_IN', 'CHECK_OUT') NOT NULL,
    `photo_key` VARCHAR(512) NOT NULL,
    `captured_at` DATETIME(3) NOT NULL,
    `submitted_at` DATETIME(3) NOT NULL,
    `position_at` DATETIME(3) NOT NULL,
    `latitude` DECIMAL(9, 6) NOT NULL,
    `longitude` DECIMAL(9, 6) NOT NULL,
    `accuracy_meters` DECIMAL(10, 2) NOT NULL,
    `distance_meters` DECIMAL(10, 2) NOT NULL,
    `location_name` VARCHAR(150) NOT NULL,
    `location_latitude` DECIMAL(9, 6) NOT NULL,
    `location_longitude` DECIMAL(9, 6) NOT NULL,
    `location_radius_meters` DECIMAL(10, 2) NOT NULL,

    UNIQUE INDEX `attendance_evidence_attendance_id_event_type_key`(`attendance_id`, `event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `type` ENUM('LEAVE', 'SICK', 'PERMISSION', 'ATTENDANCE_CORRECTION') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `reason` VARCHAR(2000) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `proposed_check_in_at` DATETIME(3) NULL,
    `proposed_check_out_at` DATETIME(3) NULL,
    `base_version` INTEGER NULL,
    `reviewer_account_id` INTEGER NULL,
    `decided_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `requests_employee_id_start_date_idx`(`employee_id`, `start_date`),
    INDEX `requests_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_corrections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attendance_id` INTEGER NOT NULL,
    `request_id` INTEGER NOT NULL,
    `before_check_in_at` DATETIME(3) NULL,
    `before_check_out_at` DATETIME(3) NULL,
    `after_check_in_at` DATETIME(3) NOT NULL,
    `after_check_out_at` DATETIME(3) NULL,
    `reason` VARCHAR(2000) NOT NULL,
    `reviewer_account_id` INTEGER NOT NULL,
    `decided_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_corrections_request_id_key`(`request_id`),
    INDEX `attendance_corrections_attendance_id_decided_at_idx`(`attendance_id`, `decided_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `attendances_work_date_idx` ON `attendances`(`work_date`);

-- AddForeignKey
ALTER TABLE `attendance_settings` ADD CONSTRAINT `attendance_settings_work_location_id_fkey` FOREIGN KEY (`work_location_id`) REFERENCES `work_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_evidence` ADD CONSTRAINT `attendance_evidence_attendance_id_fkey` FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_attendance_id_fkey` FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_corrections` ADD CONSTRAINT `attendance_corrections_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints and generated columns are maintained in SQL because Prisma schema does not express them.
ALTER TABLE `work_locations`
  ADD CONSTRAINT `work_locations_latitude_check` CHECK (`latitude` BETWEEN -90 AND 90),
  ADD CONSTRAINT `work_locations_longitude_check` CHECK (`longitude` BETWEEN -180 AND 180),
  ADD CONSTRAINT `work_locations_radius_check` CHECK (`radius_meters` > 0);

ALTER TABLE `attendance_settings`
  ADD CONSTRAINT `attendance_settings_singleton_check` CHECK (`id` = 1);

ALTER TABLE `attendances`
  ADD CONSTRAINT `attendances_times_check` CHECK (`check_out_at` IS NULL OR (`check_in_at` IS NOT NULL AND `check_out_at` > `check_in_at`)),
  ADD CONSTRAINT `attendances_version_check` CHECK (`version` > 0);

ALTER TABLE `attendance_evidence`
  ADD CONSTRAINT `evidence_latitude_check` CHECK (`latitude` BETWEEN -90 AND 90 AND `location_latitude` BETWEEN -90 AND 90),
  ADD CONSTRAINT `evidence_longitude_check` CHECK (`longitude` BETWEEN -180 AND 180 AND `location_longitude` BETWEEN -180 AND 180),
  ADD CONSTRAINT `evidence_distance_check` CHECK (`accuracy_meters` >= 0 AND `distance_meters` >= 0 AND `location_radius_meters` > 0);

ALTER TABLE `requests`
  ADD COLUMN `pending_correction_date` DATE GENERATED ALWAYS AS
    (CASE WHEN `type` = 'ATTENDANCE_CORRECTION' AND `status` = 'PENDING' THEN `start_date` ELSE NULL END) STORED,
  ADD UNIQUE INDEX `requests_pending_correction_key` (`employee_id`, `pending_correction_date`),
  ADD CONSTRAINT `requests_date_check` CHECK (`end_date` >= `start_date`),
  ADD CONSTRAINT `requests_correction_check` CHECK (
    (`type` = 'ATTENDANCE_CORRECTION' AND `start_date` = `end_date` AND `base_version` IS NOT NULL AND `base_version` >= 0 AND (`proposed_check_in_at` IS NOT NULL OR `proposed_check_out_at` IS NOT NULL)) OR
    (`type` <> 'ATTENDANCE_CORRECTION' AND `base_version` IS NULL AND `proposed_check_in_at` IS NULL AND `proposed_check_out_at` IS NULL)
  ),
  ADD CONSTRAINT `requests_decision_check` CHECK (
    (`status` = 'PENDING' AND `reviewer_account_id` IS NULL AND `decided_at` IS NULL) OR
    (`status` IN ('APPROVED', 'REJECTED') AND `reviewer_account_id` IS NOT NULL AND `decided_at` IS NOT NULL)
  );

ALTER TABLE `attendance_corrections`
  ADD CONSTRAINT `corrections_after_times_check` CHECK (`after_check_out_at` IS NULL OR `after_check_out_at` > `after_check_in_at`);
