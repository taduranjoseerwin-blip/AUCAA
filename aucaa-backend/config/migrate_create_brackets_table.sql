-- idempotent migration: create brackets table and add bracket_id to games if missing
CREATE TABLE IF NOT EXISTS brackets (
  bracket_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  size INT NOT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX (league_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- add bracket_id column to games if it doesn't exist
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS bracket_id BIGINT NULL,
  ADD CONSTRAINT IF NOT EXISTS fk_games_bracket FOREIGN KEY (bracket_id) REFERENCES brackets(bracket_id) ON DELETE SET NULL;
