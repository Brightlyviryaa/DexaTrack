-- DropForeignKey
ALTER TABLE `email_tokens` DROP FOREIGN KEY `email_tokens_account_id_fkey`;

-- DropForeignKey
ALTER TABLE `sessions` DROP FOREIGN KEY `sessions_account_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_operations` DROP FOREIGN KEY `user_operations_account_id_fkey`;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_tokens` ADD CONSTRAINT `email_tokens_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_operations` ADD CONSTRAINT `user_operations_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `user_operations` RENAME INDEX `request_id` TO `user_operations_request_id_key`;
