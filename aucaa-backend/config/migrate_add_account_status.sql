USE aucaa_db;

ALTER TABLE users
  MODIFY status ENUM('active', 'pending', 'suspended', 'approved', 'rejected')
  NOT NULL DEFAULT 'pending';

UPDATE users SET status = 'approved' WHERE status = 'active';
UPDATE users SET status = 'rejected' WHERE status = 'suspended';

ALTER TABLE users
  MODIFY status ENUM('pending', 'approved', 'rejected')
  NOT NULL DEFAULT 'pending';
