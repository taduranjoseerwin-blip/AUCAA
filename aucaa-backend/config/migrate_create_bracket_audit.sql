-- create audit table for bracket operations
CREATE TABLE IF NOT EXISTS bracket_audit (
  audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  bracket_id BIGINT NULL,
  league_id INT NULL,
  action VARCHAR(64) NOT NULL,
  user_id INT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (bracket_id),
  INDEX (league_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
