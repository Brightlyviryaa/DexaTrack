ALTER TABLE employees ADD account_id INTEGER NULL;
CREATE UNIQUE INDEX employees_account_id_key ON employees(account_id);
