ALTER TABLE `attendance_settings`
  ADD COLUMN `work_start_time` VARCHAR(5) NOT NULL DEFAULT '08:00',
  ADD CONSTRAINT `attendance_settings_start_time_check` CHECK (`work_start_time` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$');
