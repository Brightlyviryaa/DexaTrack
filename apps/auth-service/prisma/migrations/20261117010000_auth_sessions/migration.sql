ALTER TABLE accounts
  MODIFY employee_id INTEGER NULL,
  MODIFY password_hash VARCHAR(255) NULL,
  ADD approval ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD syncing BOOLEAN NOT NULL DEFAULT false,
  ADD archived_at DATETIME(3) NULL;
-- Existing accounts remain approved; new registrations default to pending.
UPDATE accounts SET approval = 'APPROVED';
CREATE TABLE sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  account_id INTEGER NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  INDEX sessions_account_id_idx(account_id), INDEX sessions_expires_at_idx(expires_at),
  CONSTRAINT sessions_account_id_fkey FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE email_tokens (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  account_id INTEGER NOT NULL,
  purpose ENUM('ACTIVATE','RESET') NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  INDEX email_tokens_account_id_idx(account_id),
  CONSTRAINT email_tokens_account_id_fkey FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE identity_lock (id INTEGER NOT NULL PRIMARY KEY);
INSERT INTO identity_lock(id) VALUES (1);
CREATE TABLE user_operations (
  account_id INTEGER NOT NULL PRIMARY KEY,
  request_id VARCHAR(36) NOT NULL UNIQUE,
  profile JSON NOT NULL,
  completed_at DATETIME(3) NULL,
  CONSTRAINT user_operations_account_id_fkey FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
