-- Preserve the pending-correction generated column and its unique index from the workforce migration.
ALTER TABLE `attendances`
  ADD COLUMN `work_start_time` VARCHAR(5) NOT NULL DEFAULT '08:00',
  ADD CONSTRAINT `attendances_work_start_check` CHECK (`work_start_time` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$');
