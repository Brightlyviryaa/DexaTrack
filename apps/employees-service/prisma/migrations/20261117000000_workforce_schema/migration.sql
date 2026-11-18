-- AlterTable
ALTER TABLE `employees` MODIFY `employee_no` VARCHAR(36) NOT NULL;

-- CreateIndex
CREATE INDEX `employees_is_active_full_name_idx` ON `employees`(`is_active`, `full_name`);
